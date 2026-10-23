import { defineStore } from 'pinia';
import {
  MAX_WATCH_IMAGE_BYTES,
  normalizeResumedBulkDraftJob,
  photoSortStamp,
  planPhotoPairs,
  retryFailedBulkDraftJobs,
  summarizePhotoCreatedAt,
  type BulkDraftQueueStatus,
  type PhotoPairError,
  type PhotoPairInput,
  type PhotoSortSource,
} from '@luxtime/shared';
import { invalidateAdminCache, invalidateAdminCachePrefix } from '~/utils/admin-cache';
import { extractApiErrorMessage } from '~/utils/api-error';
import { invalidateStorefrontCatalogCaches } from '~/utils/storefront-cache';
import { retryAfterMs, sniffImageKind } from '~/utils/draft-image';
import {
  isJunkZipName,
  readZipEntries,
  readZipEntry,
  shouldRecommendLooseFiles,
} from '~/utils/zip-entries';

export type BulkDraftStatus = BulkDraftQueueStatus;

export type BulkDraftSettlement = {
  seq: number;
  done: number;
  failed: number;
};

type BulkDraftRuntime = {
  uploadBase: string;
  run: (fn: () => Promise<string>) => Promise<string>;
};

let runtime: BulkDraftRuntime | null = null;

export function bindWatchBulkDraftRuntime(next: BulkDraftRuntime) {
  runtime = next;
}

function currentUploadBase() {
  if (runtime?.uploadBase) return runtime.uploadBase.replace(/\/$/, '');
  return useApiUploadUrl().replace(/\/$/, '');
}

function inAppContext(fn: () => Promise<string>): Promise<string> {
  if (runtime) return runtime.run(fn);
  return fn();
}

export type BulkDraftJob = {
  id: string;
  batchId: string;
  idempotencyKey: string;
  frontName: string;
  backName: string;
  status: BulkDraftStatus;
  progress: number;
  errorMessage?: string;
  watchId?: string;
};

type StoredPair = {
  front: Blob;
  back: Blob;
  frontType: string;
  backType: string;
};

export type BulkDraftPreviewPair = {
  id: string;
  batchId: string;
  idempotencyKey: string;
  frontName: string;
  backName: string;
  frontUrl: string;
  backUrl: string;
  frontSortAt?: number;
  backSortAt?: number;
  frontSortSource: PhotoSortSource;
  backSortSource: PhotoSortSource;
};

export type BulkDraftPreview = {
  source: 'zip' | 'loose';
  noCreatedAt: boolean;
  missingCreatedAt: string[];
  pairs: BulkDraftPreviewPair[];
};

type HeldPair = Omit<BulkDraftPreviewPair, 'frontUrl' | 'backUrl'> & StoredPair;

type PersistedPreview = Omit<BulkDraftPreview, 'pairs'> & {
  pairs: Array<Omit<BulkDraftPreviewPair, 'frontUrl' | 'backUrl'>>;
};

const LS_KEY = 'luxtimee.bulk-draft.v1';
const PREVIEW_KEY = 'luxtimee.bulk-draft.preview.v1';
const DB_NAME = 'luxtimee-bulk-draft';
const DB_STORE = 'pairs';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB'));
  });
}

async function idbPut(id: string, value: StoredPair) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB'));
  });
  db.close();
}

async function idbGet(id: string): Promise<StoredPair | null> {
  const db = await openDb();
  const value = await new Promise<StoredPair | null>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const request = tx.objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve((request.result as StoredPair | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB'));
  });
  db.close();
  return value;
}

async function idbDelete(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB'));
  });
  db.close();
}

function zipBaseName(name: string) {
  return name.split(/[/\\]/).pop() || name;
}

function sortMeta(file: PhotoPairInput) {
  const stamp = photoSortStamp(file);
  return { sortAt: stamp.ms, sortSource: stamp.source };
}

function revokePreviewUrls(pairs: BulkDraftPreviewPair[]) {
  if (typeof URL === 'undefined' || !URL.revokeObjectURL) return;
  for (const pair of pairs) {
    URL.revokeObjectURL(pair.frontUrl);
    URL.revokeObjectURL(pair.backUrl);
  }
}

export const useWatchBulkDraftStore = defineStore('watchBulkDraft', {
  state: () => ({
    jobs: [] as BulkDraftJob[],
    preparing: false,
    prepareLabel: '',
    prepareErrors: [] as PhotoPairError[],
    largeZipWarning: false,
    preview: null as BulkDraftPreview | null,
    confirming: false,
    settlement: null as BulkDraftSettlement | null,
    ackedSettlement: 0,
    _running: 0,
    _hydrated: false,
    _completedRuns: 0,
  }),
  getters: {
    pendingCount: (state) =>
      state.jobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
    doneCount: (state) => state.jobs.filter((job) => job.status === 'done').length,
    failedCount: (state) => state.jobs.filter((job) => job.status === 'error').length,
    activeJobs: (state) => state.jobs.filter((job) => job.status !== 'done'),
  },
  actions: {
    hydrate() {
      if (!import.meta.client || this._hydrated) return;
      this._hydrated = true;
      this._discardUnconfirmedPreview();
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const jobs = JSON.parse(raw) as BulkDraftJob[];
        if (!Array.isArray(jobs)) return;
        this.jobs = jobs
          .filter((job) => job && typeof job.idempotencyKey === 'string')
          .map((job) => normalizeResumedBulkDraftJob(job));
      } catch {
        this.jobs = [];
      }
      this._pump();
      if (!this.pendingCount && this.doneCount) {
        this._completedRuns += 1;
        this._noteSettlement();
      }
    },

    persist() {
      if (!import.meta.client) return;
      if (!this.jobs.length) {
        localStorage.removeItem(LS_KEY);
        return;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(this.jobs.map(({ ...job }) => job)));
    },

    async begin(files: File[]) {
      if (this.preparing) return;
      this.prepareErrors = [];
      this.largeZipWarning = false;
      if (!files.length) return;
      const zip = files.find((file) => /\.zip$/i.test(file.name));
      if (zip && (files.length > 1 || !/\.zip$/i.test(files[0]?.name ?? ''))) {
        this.prepareErrors = [{
          fileName: zip.name,
          message: `${zip.name}: sube un solo ZIP o solo fotos sueltas.`,
        }];
        return;
      }
      this.preparing = true;
      try {
        if (this.preview) await this.cancelPreview();
        if (zip) await this._beginZip(zip);
        else await this._beginLoose(files);
      } catch (error) {
        this.prepareErrors = [{
          fileName: zip?.name ?? files[0]?.name ?? '',
          message: error instanceof Error ? error.message : 'No se pudieron leer las fotos.',
        }];
      } finally {
        this.preparing = false;
        this.prepareLabel = '';
        this._noteSettlement();
      }
    },

    async _beginLoose(files: File[]) {
      const batchId = crypto.randomUUID();
      const inputs = files.map((file) => ({
        name: file.name,
        size: file.size,
        mime: file.type,
        modifiedAt: file.lastModified,
        file,
      }));
      const planned = planPhotoPairs(inputs, batchId, MAX_WATCH_IMAGE_BYTES);
      if (planned.errors.length) {
        this.prepareErrors = planned.errors;
        return;
      }
      const errors: PhotoPairError[] = [];
      const staged: HeldPair[] = [];
      for (const [index, pair] of planned.pairs.entries()) {
        this.prepareLabel = `Revisando ${index + 1} de ${planned.pairs.length}`;
        const frontType = await sniffImageKind(pair.front.file);
        const backType = await sniffImageKind(pair.back.file);
        if (!frontType) {
          errors.push({
            fileName: pair.front.name,
            message: `${pair.front.name}: no es un JPEG, PNG o WEBP válido.`,
          });
        }
        if (!backType) {
          errors.push({
            fileName: pair.back.name,
            message: `${pair.back.name}: no es un JPEG, PNG o WEBP válido.`,
          });
        }
        if (!frontType || !backType) continue;
        const frontSort = sortMeta(pair.front);
        const backSort = sortMeta(pair.back);
        staged.push({
          id: crypto.randomUUID(),
          batchId,
          idempotencyKey: pair.idempotencyKey,
          frontName: pair.front.name,
          backName: pair.back.name,
          front: pair.front.file,
          back: pair.back.file,
          frontType,
          backType,
          frontSortAt: frontSort.sortAt,
          backSortAt: backSort.sortAt,
          frontSortSource: frontSort.sortSource,
          backSortSource: backSort.sortSource,
        });
      }
      if (errors.length) {
        this.prepareErrors = errors;
        return;
      }
      await this._holdPreview('loose', inputs, staged);
    },

    async _beginZip(file: File) {
      if (shouldRecommendLooseFiles(file.size)) this.largeZipWarning = true;
      const entries = (await readZipEntries(file)).filter((entry) => !isJunkZipName(entry.name));
      const batchId = crypto.randomUUID();
      const baseCounts = new Map<string, number>();
      for (const entry of entries) {
        const base = zipBaseName(entry.name);
        baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
      }
      const used = new Map<string, number>();
      const inputs = entries.map((entry) => {
        const base = zipBaseName(entry.name);
        const next = (used.get(base) ?? 0) + 1;
        used.set(base, next);
        const name = (baseCounts.get(base) ?? 0) > 1 ? `${entry.name}` : base;
        return {
          name,
          size: entry.uncompressedSize,
          mime: '',
          createdAt: entry.createdAt,
          modifiedAt: entry.modifiedAt,
          entry,
        };
      });
      const planned = planPhotoPairs(inputs, batchId, MAX_WATCH_IMAGE_BYTES);
      if (planned.errors.length) {
        this.prepareErrors = planned.errors;
        return;
      }
      const staged: HeldPair[] = [];
      const errors: PhotoPairError[] = [];
      for (const [index, pair] of planned.pairs.entries()) {
        this.prepareLabel = `Leyendo ${index + 1} de ${planned.pairs.length}`;
        try {
          const frontBytes = await readZipEntry(file, pair.front.entry);
          const backBytes = await readZipEntry(file, pair.back.entry);
          const frontType = await sniffImageKind(new Blob([frontBytes as BlobPart]));
          const backType = await sniffImageKind(new Blob([backBytes as BlobPart]));
          if (!frontType || !backType) {
            const failed = !frontType ? pair.front.name : pair.back.name;
            errors.push({
              fileName: failed,
              message: `${failed}: no es un JPEG, PNG o WEBP válido.`,
            });
            continue;
          }
          const frontSort = sortMeta(pair.front);
          const backSort = sortMeta(pair.back);
          staged.push({
            id: crypto.randomUUID(),
            batchId,
            idempotencyKey: pair.idempotencyKey,
            frontName: pair.front.name,
            backName: pair.back.name,
            front: new Blob([frontBytes as BlobPart], { type: frontType }),
            back: new Blob([backBytes as BlobPart], { type: backType }),
            frontType,
            backType,
            frontSortAt: frontSort.sortAt,
            backSortAt: backSort.sortAt,
            frontSortSource: frontSort.sortSource,
            backSortSource: backSort.sortSource,
          });
        } catch (error) {
          errors.push({
            fileName: pair.front.name,
            message: error instanceof Error ? error.message : `${pair.front.name}: no se pudo leer.`,
          });
        }
      }
      if (errors.length) {
        this.prepareErrors = errors;
        return;
      }
      await this._holdPreview('zip', inputs, staged);
    },

    async _holdPreview(source: 'zip' | 'loose', inputs: readonly PhotoPairInput[], staged: HeldPair[]) {
      const coverage = summarizePhotoCreatedAt(inputs);
      const persisted: PersistedPreview = {
        source,
        noCreatedAt: source === 'zip' && coverage.none,
        missingCreatedAt: source === 'zip' && !coverage.none ? coverage.missing : [],
        pairs: staged.map((job) => ({
          id: job.id,
          batchId: job.batchId,
          idempotencyKey: job.idempotencyKey,
          frontName: job.frontName,
          backName: job.backName,
          frontSortAt: job.frontSortAt,
          backSortAt: job.backSortAt,
          frontSortSource: job.frontSortSource,
          backSortSource: job.backSortSource,
        })),
      };
      const written: string[] = [];
      try {
        for (const [index, job] of staged.entries()) {
          this.prepareLabel = `Guardando ${index + 1} de ${staged.length}`;
          await idbPut(job.id, {
            front: job.front,
            back: job.back,
            frontType: job.frontType,
            backType: job.backType,
          });
          written.push(job.id);
        }
        if (import.meta.client) localStorage.setItem(PREVIEW_KEY, JSON.stringify(persisted));
        this.preview = {
          ...persisted,
          pairs: staged.map((job) => ({
            id: job.id,
            batchId: job.batchId,
            idempotencyKey: job.idempotencyKey,
            frontName: job.frontName,
            backName: job.backName,
            frontUrl: URL.createObjectURL(job.front),
            backUrl: URL.createObjectURL(job.back),
            frontSortAt: job.frontSortAt,
            backSortAt: job.backSortAt,
            frontSortSource: job.frontSortSource,
            backSortSource: job.backSortSource,
          })),
        };
      } catch (error) {
        if (import.meta.client) localStorage.removeItem(PREVIEW_KEY);
        await Promise.all(written.map((id) => idbDelete(id).catch(() => undefined)));
        throw error;
      }
    },

    confirmPreview() {
      const preview = this.preview;
      if (!preview || this.confirming) return;
      this.confirming = true;
      const jobs: BulkDraftJob[] = preview.pairs.map((pair) => ({
        id: pair.id,
        batchId: pair.batchId,
        idempotencyKey: pair.idempotencyKey,
        frontName: pair.frontName,
        backName: pair.backName,
        status: 'queued',
        progress: 0,
      }));
      this._dropPreviewRecord();
      this.jobs.push(...jobs);
      this.persist();
      this.confirming = false;
      this._pump();
    },

    async cancelPreview() {
      if (this.confirming || !this.preview) return;
      const ids = this.preview.pairs.map((pair) => pair.id);
      this._dropPreviewRecord();
      await Promise.all(ids.map((id) => idbDelete(id).catch(() => undefined)));
    },

    _dropPreviewRecord() {
      const pairs = this.preview?.pairs ?? [];
      this.preview = null;
      if (import.meta.client) localStorage.removeItem(PREVIEW_KEY);
      revokePreviewUrls(pairs);
    },

    _discardUnconfirmedPreview() {
      if (!import.meta.client) return;
      try {
        const raw = localStorage.getItem(PREVIEW_KEY);
        if (!raw) return;
        localStorage.removeItem(PREVIEW_KEY);
        const parsed = JSON.parse(raw) as PersistedPreview;
        const ids = Array.isArray(parsed?.pairs) ? parsed.pairs.map((pair) => pair.id) : [];
        void Promise.all(
          ids.filter((id) => typeof id === 'string').map((id) => idbDelete(id).catch(() => undefined)),
        );
      } catch {
        localStorage.removeItem(PREVIEW_KEY);
      }
    },

    retry(id: string) {
      this._queueRetries(new Set([id]));
    },

    retryFailed() {
      this._queueRetries();
    },

    _queueRetries(onlyIds?: ReadonlySet<string>) {
      const next = retryFailedBulkDraftJobs(this.jobs, onlyIds);
      if (next === this.jobs) return;
      this.jobs = next as BulkDraftJob[];
      this.persist();
      this._pump();
    },

    ackSettlement(seq: number) {
      if (this.settlement?.seq === seq) this.ackedSettlement = seq;
    },

    _noteSettlement() {
      if (this._running || this.pendingCount || this.preparing || !this._completedRuns) return;
      const done = this.doneCount;
      const failed = this.failedCount;
      this._completedRuns = 0;
      if (!done && !failed) return;
      invalidateAdminCachePrefix('admin-watches-');
      invalidateAdminCache('inventory-insights');
      invalidateStorefrontCatalogCaches();
      const seq = (this.settlement?.seq ?? 0) + 1;
      this.clearFinished();
      this.settlement = { seq, done, failed };
    },

    _pump() {
      if (this._running) return;
      const next = this.jobs.find((job) => job.status === 'queued');
      if (!next) return;
      this._running = 1;
      void this._run(next);
    },

    async _run(job: BulkDraftJob) {
      let timer: ReturnType<typeof setInterval> | undefined;
      try {
        job.status = 'running';
        job.progress = 12;
        this.persist();
        timer = setInterval(() => {
          if (job.status === 'running' && job.progress < 88) job.progress += 6;
        }, 200);
        const stored = await idbGet(job.id);
        if (!stored) {
          throw new Error('Faltan las fotos en este navegador. Vuelve a elegir el par.');
        }
        const payload = await this._post(job, stored);
        job.progress = 100;
        job.status = 'done';
        job.watchId = typeof payload?.id === 'string' ? payload.id : undefined;
        job.errorMessage = undefined;
        await idbDelete(job.id).catch(() => undefined);
      } catch (error) {
        job.status = 'error';
        job.errorMessage = extractApiErrorMessage(error, 'No se pudo crear el borrador');
      } finally {
        if (timer) clearInterval(timer);
        this._completedRuns += 1;
        this._running = 0;
        try {
          this.persist();
        } catch {
          /* la cola en memoria sigue */
        }
        this._pump();
        this._noteSettlement();
      }
    },

    async _post(job: BulkDraftJob, stored: StoredPair) {
      const uploadBase = currentUploadBase();
      const auth = useAuthStore();
      const crossOrigin = /^https?:\/\//i.test(uploadBase) && !uploadBase.startsWith('/');
      let token = await inAppContext(() => auth.ensureAccessToken(true));
      let authRetried = false;
      let rateRetries = 0;

      while (rateRetries < 12) {
        const body = new FormData();
        body.append('image1', new File([stored.front], job.frontName, { type: stored.frontType }));
        body.append('image2', new File([stored.back], job.backName, { type: stored.backType }));
        body.append('idempotencyKey', job.idempotencyKey);
        const response = await fetch(`${uploadBase}/watches/bulk-draft`, {
          method: 'POST',
          body,
          credentials: crossOrigin ? 'omit' : 'include',
          signal: AbortSignal.timeout(120_000),
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.status === 401 && !authRetried) {
          authRetried = true;
          token = await inAppContext(() => auth.ensureAccessToken(true));
          continue;
        }
        if (response.status === 429) {
          rateRetries += 1;
          await delay(retryAfterMs(response.headers.get('Retry-After')));
          continue;
        }
        const payload = await response.json().catch(() => null) as { id?: string; message?: string } | null;
        if (!response.ok) {
          throw {
            statusCode: response.status,
            data: payload,
            message: payload?.message,
          };
        }
        return payload;
      }
      throw new Error('Demasiadas solicitudes. Reintenta el par.');
    },

    clearFinished() {
      const done = this.jobs.filter((job) => job.status === 'done');
      this.jobs = this.jobs.filter((job) => job.status !== 'done');
      this.persist();
      for (const job of done) void idbDelete(job.id).catch(() => undefined);
    },
  },
});
