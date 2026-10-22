import { defineStore } from 'pinia';
import {
  MAX_WATCH_IMAGE_BYTES,
  planPhotoPairs,
  type PhotoPairError,
} from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { retryAfterMs, sniffImageKind } from '~/utils/draft-image';
import {
  isJunkZipName,
  readZipEntries,
  readZipEntry,
  shouldRecommendLooseFiles,
} from '~/utils/zip-entries';

export type BulkDraftStatus = 'queued' | 'running' | 'done' | 'error';

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

const LS_KEY = 'luxtimee.bulk-draft.v1';
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

export const useWatchBulkDraftStore = defineStore('watchBulkDraft', {
  state: () => ({
    jobs: [] as BulkDraftJob[],
    preparing: false,
    prepareLabel: '',
    prepareErrors: [] as PhotoPairError[],
    largeZipWarning: false,
    _running: 0,
    _hydrated: false,
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
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const jobs = JSON.parse(raw) as BulkDraftJob[];
        if (!Array.isArray(jobs)) return;
        this.jobs = jobs
          .filter((job) => job && typeof job.idempotencyKey === 'string')
          .map((job) => ({
            ...job,
            status: job.status === 'running' ? 'queued' : job.status,
            progress: job.status === 'done' ? 100 : 0,
          }));
      } catch {
        this.jobs = [];
      }
      this._pump();
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
      const staged: Array<BulkDraftJob & StoredPair> = [];
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
        staged.push({
          id: crypto.randomUUID(),
          batchId,
          idempotencyKey: pair.idempotencyKey,
          frontName: pair.front.name,
          backName: pair.back.name,
          status: 'queued',
          progress: 0,
          front: pair.front.file,
          back: pair.back.file,
          frontType,
          backType,
        });
      }
      if (errors.length) {
        this.prepareErrors = errors;
        return;
      }
      await this._commitStaged(staged);
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
          modifiedAt: entry.modifiedAt,
          entry,
        };
      });
      const planned = planPhotoPairs(inputs, batchId, MAX_WATCH_IMAGE_BYTES);
      if (planned.errors.length) {
        this.prepareErrors = planned.errors;
        return;
      }
      const staged: BulkDraftJob[] = [];
      const errors: PhotoPairError[] = [];
      for (const [index, pair] of planned.pairs.entries()) {
        this.prepareLabel = `Leyendo ${index + 1} de ${planned.pairs.length}`;
        const id = crypto.randomUUID();
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
          await idbPut(id, {
            front: new Blob([frontBytes as BlobPart], { type: frontType }),
            back: new Blob([backBytes as BlobPart], { type: backType }),
            frontType,
            backType,
          });
          staged.push({
            id,
            batchId,
            idempotencyKey: pair.idempotencyKey,
            frontName: pair.front.name,
            backName: pair.back.name,
            status: 'queued',
            progress: 0,
          });
        } catch (error) {
          errors.push({
            fileName: pair.front.name,
            message: error instanceof Error ? error.message : `${pair.front.name}: no se pudo leer.`,
          });
        }
      }
      if (errors.length) {
        await Promise.all(staged.map((job) => idbDelete(job.id).catch(() => undefined)));
        this.prepareErrors = errors;
        return;
      }
      this.jobs.push(...staged);
      this.persist();
      this._pump();
    },

    async _commitStaged(staged: Array<BulkDraftJob & StoredPair>) {
      for (const [index, job] of staged.entries()) {
        this.prepareLabel = `Guardando ${index + 1} de ${staged.length}`;
        await idbPut(job.id, {
          front: job.front,
          back: job.back,
          frontType: job.frontType,
          backType: job.backType,
        });
        this.jobs.push({
          id: job.id,
          batchId: job.batchId,
          idempotencyKey: job.idempotencyKey,
          frontName: job.frontName,
          backName: job.backName,
          status: 'queued',
          progress: 0,
        });
        this.persist();
      }
      this._pump();
    },

    retry(id: string) {
      const job = this.jobs.find((item) => item.id === id);
      if (!job || job.status !== 'error') return;
      job.status = 'queued';
      job.progress = 0;
      job.errorMessage = undefined;
      this.persist();
      this._pump();
    },

    retryFailed() {
      for (const job of this.jobs) {
        if (job.status !== 'error') continue;
        job.status = 'queued';
        job.progress = 0;
        job.errorMessage = undefined;
      }
      this.persist();
      this._pump();
    },

    _pump() {
      if (this._running) return;
      const next = this.jobs.find((job) => job.status === 'queued');
      if (!next) return;
      this._running = 1;
      void this._run(next);
    },

    async _run(job: BulkDraftJob) {
      job.status = 'running';
      job.progress = 12;
      this.persist();
      const timer = setInterval(() => {
        if (job.status === 'running' && job.progress < 88) job.progress += 6;
      }, 200);
      try {
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
        clearInterval(timer);
        this.persist();
        this._running = 0;
        this._pump();
      }
    },

    async _post(job: BulkDraftJob, stored: StoredPair) {
      const uploadBase = useApiUploadUrl().replace(/\/$/, '');
      const auth = useAuthStore();
      const crossOrigin = /^https?:\/\//i.test(uploadBase) && !uploadBase.startsWith('/');
      let token = await auth.ensureAccessToken(true);
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
          token = await auth.ensureAccessToken(true);
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
