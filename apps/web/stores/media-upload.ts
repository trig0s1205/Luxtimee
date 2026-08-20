import { defineStore } from 'pinia';
import { validateWatchVideoFile } from '~/utils/video-validation';
import { extractApiErrorMessage } from '~/utils/api-error';
import { authFetchHeaders, resolveAccessToken } from '~/utils/auth-token';

export type MediaFileStatus = 'queue' | 'uploading' | 'done' | 'error';
export type MediaSlot = 'image1' | 'image2' | 'video';

export type UploadJob = {
  id: string;
  watchId: string;
  model: string;
  brandName: string;
  intendedShowInCatalog: boolean;
  files: { image1: File; image2: File; video: File };
  status: 'queue' | 'uploading' | 'done' | 'error';
  fileStatuses: { image1: MediaFileStatus; image2: MediaFileStatus; video: MediaFileStatus };
  errorMessage?: string;
  createdAt: number;
};

type MediaSlotResult = { status: 'done' } | { status: 'error'; message?: string };

const SLOT_LABEL: Record<MediaSlot, string> = {
  image1: 'Foto principal',
  image2: 'Foto secundaria',
  video: 'Video',
};

function pendingSlots(job: UploadJob): MediaSlot[] {
  return (['image1', 'image2', 'video'] as const).filter((slot) => job.fileStatuses[slot] !== 'done');
}

export const useMediaUploadStore = defineStore('mediaUpload', {
  state: () => ({
    jobs: [] as UploadJob[],
    _processing: false,
  }),
  getters: {
    pendingCount: (state) =>
      state.jobs.filter((j) => j.status === 'queue' || j.status === 'uploading').length,
    hasDone: (state) => state.jobs.some((j) => j.status === 'done'),
    hasJobs: (state) => state.jobs.length > 0,
  },
  actions: {
    enqueue(job: Omit<UploadJob, 'id' | 'status' | 'fileStatuses' | 'createdAt'>) {
      this.jobs.push({
        ...job,
        id: crypto.randomUUID(),
        status: 'queue',
        fileStatuses: { image1: 'queue', image2: 'queue', video: 'queue' },
        createdAt: Date.now(),
      });
      void this._processNext();
    },

    async _processNext() {
      if (this._processing) return;
      const job = this.jobs.find((j) => j.status === 'queue');
      if (!job) return;

      this._processing = true;
      job.status = 'uploading';
      const toUpload = pendingSlots(job);
      for (const slot of toUpload) {
        job.fileStatuses[slot] = 'uploading';
      }

      const skipVideo = !toUpload.includes('video');
      let videoClientError: string | null = null;
      if (!skipVideo) {
        videoClientError = await validateWatchVideoFile(job.files.video);
        if (videoClientError) {
          job.fileStatuses.video = 'error';
        }
      }

      const sendSlots = toUpload.filter((slot) => slot !== 'video' || !videoClientError);

      if (sendSlots.length === 0) {
        job.status = 'error';
        job.errorMessage = videoClientError || 'No hay archivos pendientes para subir.';
        useToast().error(`Video inválido — ${job.brandName} ${job.model}`);
        this._processing = false;
        void this._processNext();
        return;
      }

      try {
        const uploadBase = useApiUploadUrl();
        const auth = useAuthStore();
        const crossOrigin = /^https?:\/\//i.test(uploadBase) && !uploadBase.startsWith('/');

        function buildFormData() {
          const fd = new FormData();
          if (sendSlots.includes('image1')) fd.append('image1', job.files.image1);
          if (sendSlots.includes('image2')) fd.append('image2', job.files.image2);
          if (sendSlots.includes('video')) fd.append('video', job.files.video);
          return fd;
        }

        async function postUpload(token: string) {
          return fetch(`${uploadBase}/watches/${job.watchId}/upload-media`, {
            method: 'POST',
            body: buildFormData(),
            credentials: crossOrigin ? 'omit' : 'include',
            signal: AbortSignal.timeout(300_000),
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        let token = await auth.ensureAccessToken(true);
        let res = await postUpload(token);

        if (res.status === 401) {
          token = await auth.ensureAccessToken(true);
          res = await postUpload(token);
        }

        const payload = await res.json().catch(() => null) as {
          message?: string;
          mediaResults?: Partial<Record<MediaSlot, MediaSlotResult>>;
        } | null;

        if (!res.ok) {
          const apiMessage = payload?.message;
          for (const slot of sendSlots) {
            if (job.fileStatuses[slot] === 'uploading') job.fileStatuses[slot] = 'error';
          }
          if (videoClientError) job.fileStatuses.video = 'error';

          if (res.status === 401) {
            throw new Error('Tu sesión expiró. Recarga la página e intenta de nuevo.');
          }
          if (res.status === 413) {
            throw new Error('Los archivos son demasiado grandes. Usa imágenes más pequeñas o un video más corto.');
          }

          throw { statusCode: res.status, data: payload, message: apiMessage };
        }

        const results = payload?.mediaResults;
        const errorParts: string[] = [];

        for (const slot of sendSlots) {
          const result = results?.[slot];
          if (result?.status === 'done') {
            job.fileStatuses[slot] = 'done';
          } else if (result?.status === 'error') {
            job.fileStatuses[slot] = 'error';
            errorParts.push(`${SLOT_LABEL[slot]}: ${result.message || 'Error al procesar'}`);
          } else if (!results) {
            job.fileStatuses[slot] = 'done';
          } else {
            job.fileStatuses[slot] = 'error';
            errorParts.push(`${SLOT_LABEL[slot]}: No se pudo completar la subida`);
          }
        }

        if (videoClientError) {
          job.fileStatuses.video = 'error';
          errorParts.push(`Video: ${videoClientError}`);
        }

        const allDone = pendingSlots(job).length === 0;
        if (allDone) {
          job.status = 'done';
          job.errorMessage = undefined;

          if (job.intendedShowInCatalog) {
            const apiBase = useApiBaseUrl();
            await $fetch(`${apiBase}/watches/${job.watchId}`, {
              method: 'PATCH',
              body: { showInCatalog: true },
              credentials: 'include',
              headers: authFetchHeaders(resolveAccessToken(auth.accessToken)),
            });
          }

          useToast().success(`Multimedia lista — ${job.brandName} ${job.model}`);
        } else {
          job.status = 'error';
          job.errorMessage = errorParts.join(' · ') || videoClientError || 'Algunos archivos no se pudieron procesar.';
          const photosOk = job.fileStatuses.image1 === 'done' && job.fileStatuses.image2 === 'done';
          if (photosOk && job.fileStatuses.video === 'error') {
            useToast().error(`Fotos listas. El video no se pudo procesar — ${job.brandName} ${job.model}`);
          } else {
            useToast().error(`Error multimedia — ${job.brandName} ${job.model}`);
          }
        }
      } catch (err: unknown) {
        for (const slot of sendSlots) {
          if (job.fileStatuses[slot] === 'uploading') job.fileStatuses[slot] = 'error';
        }
        if (videoClientError) job.fileStatuses.video = 'error';
        job.status = pendingSlots(job).length === 0 ? 'done' : 'error';
        const fromApi = extractApiErrorMessage(err, '')
          || (err instanceof Error && err.name === 'TimeoutError'
            ? 'La subida tardó demasiado. Usa un video más corto.'
            : '')
          || (err instanceof Error && err.message && !err.message.startsWith('[')
            ? err.message
            : '');
        const parts = [
          fromApi,
          videoClientError ? `Video: ${videoClientError}` : '',
        ].filter(Boolean);
        job.errorMessage = parts.join(' · ')
          || 'No se pudo completar la subida. Revisa la conexión e intenta de nuevo.';
        useToast().error(`Error multimedia — ${job.brandName} ${job.model}`);
      } finally {
        this._processing = false;
        void this._processNext();
      }
    },

    retry(jobId: string) {
      const job = this.jobs.find((j) => j.id === jobId);
      if (!job || job.status === 'uploading') return;
      job.status = 'queue';
      for (const slot of ['image1', 'image2', 'video'] as const) {
        if (job.fileStatuses[slot] === 'error') job.fileStatuses[slot] = 'queue';
      }
      job.errorMessage = undefined;
      void this._processNext();
    },

    dismiss(jobId: string) {
      this.jobs = this.jobs.filter((j) => j.id !== jobId);
    },

    clearDone() {
      this.jobs = this.jobs.filter((j) => j.status !== 'done');
    },
  },
});
