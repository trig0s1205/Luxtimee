import { defineStore } from 'pinia';
import {
  MAX_BULK_DRAFT_PHOTOS,
  bulkDraftIdempotencyKey,
  normalizeResumedBulkDraftJob,
  retryFailedBulkDraftJobs,
  swapBulkDraftPairSides,
  swapBulkDraftStoredSides,
  type BulkDraftQueueStatus,
  type PhotoPairError,
  type PhotoSortSource,
} from '@luxtime/shared';
import { invalidateAdminCache, invalidateAdminCachePrefix } from '~/utils/admin-cache';
import { extractApiErrorMessage } from '~/utils/api-error';
import { moveItem, pairInOrder, sortByNaturalName } from '~/utils/bulk-photo-arrange';
import { compressCatalogImage } from '~/utils/catalog-image';
import { invalidateStorefrontCatalogCaches } from '~/utils/storefront-cache';
import { retryAfterMs } from '~/utils/draft-image';

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
let swapTail: Promise<void> = Promise.resolve();

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
  back: Blob | null;
  frontType: string;
  backType: string | null;
};

type PreparedPhoto = {
  name: string;
  blob: Blob;
  type: string;
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

export type BulkDraftOrphan = {
  id: string;
  name: string;
  url: string;
};

export type BulkDraftBoardPhoto = {
  id: string;
  name: string;
  url: string;
};

export type BulkDraftPreview = {
  pairs: BulkDraftPreviewPair[];
  orphan: BulkDraftOrphan | null;
};

type HeldPair = Omit<BulkDraftPreviewPair, 'frontUrl' | 'backUrl'> & StoredPair;

type PersistedPreview = {
  orphanId?: string;
  pairs: Array<Omit<BulkDraftPreviewPair, 'frontUrl' | 'backUrl'>>;
};

const boardBlobs = new Map<string, PreparedPhoto>();

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

function revokeUrl(url: string) {
  if (!url || typeof URL === 'undefined' || !URL.revokeObjectURL) return;
  URL.revokeObjectURL(url);
}

function revokePreviewUrls(pairs: BulkDraftPreviewPair[], orphan: BulkDraftOrphan | null) {
  for (const pair of pairs) {
    revokeUrl(pair.frontUrl);
    revokeUrl(pair.backUrl);
  }
  if (orphan) revokeUrl(orphan.url);
}

function jpegName(name: string) {
  const base = name.split(/[/\\]/).pop() || name;
  return /\.jpe?g$/i.test(base) ? base : `${base.replace(/\.[^.]+$/, '')}.jpg`;
}

export const useWatchBulkDraftStore = defineStore('watchBulkDraft', {
  state: () => ({
    jobs: [] as BulkDraftJob[],
    preparing: false,
    prepareLabel: '',
    prepareErrors: [] as PhotoPairError[],
    board: null as BulkDraftBoardPhoto[] | null,
    selection: [] as string[],
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

    async ingest(files: File[], mode: 'sequence' | 'arrange') {
      if (this.preparing) return;
      this.prepareErrors = [];
      if (!files.length) return;
      const images = files.filter((file) => file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i.test(file.name));
      if (!images.length) {
        this.prepareErrors = [{ fileName: '', message: 'Elige fotos. Los ZIP no se usan.' }];
        return;
      }
      if (images.length > MAX_BULK_DRAFT_PHOTOS) {
        this.prepareErrors = [{
          fileName: '',
          message: `El lote admite como máximo ${MAX_BULK_DRAFT_PHOTOS} fotos.`,
        }];
        return;
      }
      this.preparing = true;
      try {
        if (this.preview) await this.cancelPreview();
        this.clearBoard();
        const prepared: PreparedPhoto[] = [];
        const errors: PhotoPairError[] = [];
        for (const [index, file] of images.entries()) {
          this.prepareLabel = `Preparando ${index + 1} de ${images.length}`;
          try {
            const blob = await compressCatalogImage(file);
            prepared.push({ name: jpegName(file.name), blob, type: 'image/jpeg' });
          } catch (error) {
            errors.push({
              fileName: file.name,
              message: error instanceof Error ? error.message : `${file.name}: no se pudo preparar.`,
            });
          }
        }
        this.prepareErrors = errors;
        if (!prepared.length) return;
        if (mode === 'arrange') {
          const board = sortByNaturalName(prepared).map((photo) => {
            const id = crypto.randomUUID();
            boardBlobs.set(id, photo);
            return { id, name: photo.name, url: URL.createObjectURL(photo.blob) };
          });
          this.board = board;
          this.selection = [];
          return;
        }
        const grouped = pairInOrder(prepared);
        await this._stageReview(grouped.pairs, grouped.leftover);
      } catch (error) {
        this.prepareErrors = [{
          fileName: images[0]?.name ?? '',
          message: error instanceof Error ? error.message : 'No se pudieron leer las fotos.',
        }];
      } finally {
        this.preparing = false;
        this.prepareLabel = '';
      }
    },

    toggleBoardPhoto(id: string) {
      if (!this.board?.some((photo) => photo.id === id)) return;
      const index = this.selection.indexOf(id);
      this.selection = index === -1
        ? [...this.selection, id]
        : this.selection.filter((item) => item !== id);
    },

    clearSelection() {
      this.selection = [];
    },

    async useBoardOrder() {
      if (!this.board?.length || this.preparing) return;
      this.selection = this.board.map((photo) => photo.id);
      await this.commitBoard();
    },

    async commitBoard() {
      if (!this.board || this.preparing) return;
      const chosen = this.selection
        .map((id) => {
          const photo = boardBlobs.get(id);
          const card = this.board?.find((item) => item.id === id);
          return photo && card ? photo : null;
        })
        .filter((photo): photo is PreparedPhoto => !!photo);
      if (!chosen.length) {
        this.prepareErrors = [{ fileName: '', message: 'Selecciona al menos una foto.' }];
        return;
      }
      const grouped = pairInOrder(chosen);
      this.preparing = true;
      try {
        await this._stageReview(grouped.pairs, grouped.leftover);
        this.clearBoard();
      } catch (error) {
        this.prepareErrors = [{
          fileName: '',
          message: error instanceof Error ? error.message : 'No se pudieron armar los pares.',
        }];
      } finally {
        this.preparing = false;
        this.prepareLabel = '';
      }
    },

    clearBoard() {
      for (const photo of this.board ?? []) revokeUrl(photo.url);
      for (const id of boardBlobs.keys()) boardBlobs.delete(id);
      this.board = null;
      this.selection = [];
    },

    async _stageReview(
      pairs: Array<{ front: PreparedPhoto; back: PreparedPhoto }>,
      leftover: PreparedPhoto | null,
    ) {
      const batchId = crypto.randomUUID();
      const staged: HeldPair[] = pairs.map((pair) => ({
        id: crypto.randomUUID(),
        batchId,
        idempotencyKey: bulkDraftIdempotencyKey(batchId, pair.front.name, pair.back.name),
        frontName: pair.front.name,
        backName: pair.back.name,
        front: pair.front.blob,
        back: pair.back.blob,
        frontType: pair.front.type,
        backType: pair.back.type,
        frontSortSource: 'none',
        backSortSource: 'none',
      }));
      const orphanId = leftover ? crypto.randomUUID() : '';
      const persisted: PersistedPreview = {
        orphanId: orphanId || undefined,
        pairs: staged.map((job) => ({
          id: job.id,
          batchId: job.batchId,
          idempotencyKey: job.idempotencyKey,
          frontName: job.frontName,
          backName: job.backName,
          frontSortSource: job.frontSortSource,
          backSortSource: job.backSortSource,
        })),
      };
      const written: string[] = [];
      try {
        for (const [index, job] of staged.entries()) {
          this.prepareLabel = `Guardando ${index + 1} de ${staged.length + (leftover ? 1 : 0)}`;
          await idbPut(job.id, {
            front: job.front,
            back: job.back,
            frontType: job.frontType,
            backType: job.backType,
          });
          written.push(job.id);
        }
        if (leftover && orphanId) {
          await idbPut(orphanId, {
            front: leftover.blob,
            back: null,
            frontType: leftover.type,
            backType: null,
          });
          written.push(orphanId);
        }
        this._writePreviewMeta(persisted);
        this.preview = {
          pairs: staged.map((job) => ({
            id: job.id,
            batchId: job.batchId,
            idempotencyKey: job.idempotencyKey,
            frontName: job.frontName,
            backName: job.backName,
            frontUrl: URL.createObjectURL(job.front),
            backUrl: URL.createObjectURL(job.back as Blob),
            frontSortSource: job.frontSortSource,
            backSortSource: job.backSortSource,
          })),
          orphan: leftover && orphanId
            ? { id: orphanId, name: leftover.name, url: URL.createObjectURL(leftover.blob) }
            : null,
        };
      } catch (error) {
        if (import.meta.client) localStorage.removeItem(PREVIEW_KEY);
        await Promise.all(written.map((id) => idbDelete(id).catch(() => undefined)));
        throw error;
      }
    },

    async confirmPreview() {
      if (!this.preview || this.confirming) return;
      this.confirming = true;
      try {
        await swapTail;
        const preview = this.preview;
        if (!preview) return;
        if (preview.orphan) void idbDelete(preview.orphan.id).catch(() => undefined);
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
        this._pump();
      } finally {
        this.confirming = false;
      }
    },

    swapPreviewPair(id: string) {
      if (!this.preview || this.confirming) return;
      const run = swapTail.then(() => this._applyPreviewSwap(id));
      swapTail = run.then(() => undefined, () => undefined);
      return run;
    },

    async _applyPreviewSwap(id: string) {
      const preview = this.preview;
      if (!preview) return;
      const pair = preview.pairs.find((item) => item.id === id);
      if (!pair?.backUrl) return;
      const before = { ...pair };
      Object.assign(pair, swapBulkDraftPairSides(pair));
      this._writePreviewMeta(this._previewMeta());
      try {
        const stored = await idbGet(id);
        if (!stored?.back || !stored.backType) throw new Error('Faltan las fotos de este par.');
        await idbPut(id, swapBulkDraftStoredSides({
          front: stored.front,
          back: stored.back,
          frontType: stored.frontType,
          backType: stored.backType,
        }));
      } catch {
        if (this.preview?.pairs.some((item) => item.id === id)) {
          Object.assign(pair, before);
          this._writePreviewMeta(this._previewMeta());
        }
      }
    },

    movePreview(id: string, direction: -1 | 1) {
      if (!this.preview || this.confirming) return;
      const index = this.preview.pairs.findIndex((pair) => pair.id === id);
      this.preview.pairs = moveItem(this.preview.pairs, index, direction);
      this._writePreviewMeta(this._previewMeta());
    },

    async removePreviewWatch(id: string) {
      if (!this.preview || this.confirming) return;
      const pair = this.preview.pairs.find((item) => item.id === id);
      if (!pair) return;
      this.preview.pairs = this.preview.pairs.filter((item) => item.id !== id);
      revokeUrl(pair.frontUrl);
      revokeUrl(pair.backUrl);
      this._writePreviewMeta(this._previewMeta());
      await idbDelete(id).catch(() => undefined);
    },

    async removePreviewPhoto(id: string, side: 'front' | 'back') {
      if (!this.preview || this.confirming) return;
      const pair = this.preview.pairs.find((item) => item.id === id);
      if (!pair) return;
      const stored = await idbGet(id);
      if (!stored) return;
      if (side === 'back') {
        if (!stored.back) return;
        revokeUrl(pair.backUrl);
        pair.backUrl = '';
        pair.backName = '';
        pair.idempotencyKey = bulkDraftIdempotencyKey(pair.batchId, pair.frontName, '');
        await idbPut(id, { ...stored, back: null, backType: null });
      } else if (stored.back && stored.backType) {
        revokeUrl(pair.frontUrl);
        pair.frontUrl = pair.backUrl;
        pair.frontName = pair.backName;
        pair.backUrl = '';
        pair.backName = '';
        pair.idempotencyKey = bulkDraftIdempotencyKey(pair.batchId, pair.frontName, '');
        await idbPut(id, {
          front: stored.back,
          back: null,
          frontType: stored.backType,
          backType: null,
        });
      } else {
        await this.removePreviewWatch(id);
        return;
      }
      this._writePreviewMeta(this._previewMeta());
    },

    async acceptOrphan() {
      const orphan = this.preview?.orphan;
      if (!orphan || this.confirming) return;
      const stored = await idbGet(orphan.id);
      if (!stored) return;
      const batchId = this.preview?.pairs[0]?.batchId ?? crypto.randomUUID();
      this.preview?.pairs.push({
        id: orphan.id,
        batchId,
        idempotencyKey: bulkDraftIdempotencyKey(batchId, orphan.name, ''),
        frontName: orphan.name,
        backName: '',
        frontUrl: orphan.url,
        backUrl: '',
        frontSortSource: 'none',
        backSortSource: 'none',
      });
      if (this.preview) this.preview.orphan = null;
      this._writePreviewMeta(this._previewMeta());
    },

    persistPreviewOrder() {
      this._writePreviewMeta(this._previewMeta());
    },

    async discardOrphan() {
      const orphan = this.preview?.orphan;
      if (!orphan || this.confirming) return;
      revokeUrl(orphan.url);
      this.preview.orphan = null;
      this._writePreviewMeta(this._previewMeta());
      await idbDelete(orphan.id).catch(() => undefined);
    },

    _previewMeta(): PersistedPreview | null {
      const preview = this.preview;
      if (!preview) return null;
      return {
        orphanId: preview.orphan?.id,
        pairs: preview.pairs.map(({ frontUrl: _frontUrl, backUrl: _backUrl, ...rest }) => rest),
      };
    },

    _writePreviewMeta(persisted: PersistedPreview | null) {
      if (!import.meta.client) return;
      if (!persisted) {
        localStorage.removeItem(PREVIEW_KEY);
        return;
      }
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(persisted));
    },

    async cancelPreview() {
      if (this.confirming || !this.preview) return;
      await swapTail;
      if (this.confirming || !this.preview) return;
      const ids = [
        ...this.preview.pairs.map((pair) => pair.id),
        ...(this.preview.orphan ? [this.preview.orphan.id] : []),
      ];
      this._dropPreviewRecord();
      await Promise.all(ids.map((id) => idbDelete(id).catch(() => undefined)));
    },

    _dropPreviewRecord() {
      const pairs = this.preview?.pairs ?? [];
      const orphan = this.preview?.orphan ?? null;
      this.preview = null;
      if (import.meta.client) localStorage.removeItem(PREVIEW_KEY);
      revokePreviewUrls(pairs, orphan);
    },

    _discardUnconfirmedPreview() {
      if (!import.meta.client) return;
      try {
        const raw = localStorage.getItem(PREVIEW_KEY);
        if (!raw) return;
        localStorage.removeItem(PREVIEW_KEY);
        const parsed = JSON.parse(raw) as PersistedPreview;
        const ids = [
          ...(Array.isArray(parsed?.pairs) ? parsed.pairs.map((pair) => pair.id) : []),
          ...(typeof parsed?.orphanId === 'string' ? [parsed.orphanId] : []),
        ];
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
      let token = await inAppContext(() => auth.ensureUploadToken());
      let authRetried = false;
      let rateRetries = 0;

      while (rateRetries < 12) {
        const body = new FormData();
        body.append('image1', new File([stored.front], job.frontName, { type: stored.frontType }));
        if (stored.back && stored.backType) {
          body.append('image2', new File([stored.back], job.backName || 'dorso.jpg', { type: stored.backType }));
        }
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
          token = await inAppContext(() => auth.ensureUploadToken(true));
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
