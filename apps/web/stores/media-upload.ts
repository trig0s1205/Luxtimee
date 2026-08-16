import { defineStore } from 'pinia';
import { validateWatchVideoFile } from '~/utils/video-validation';
import { extractApiErrorMessage } from '~/utils/api-error';
import { authFetchHeaders, resolveAccessToken } from '~/utils/auth-token';

export type MediaFileStatus = 'queue' | 'uploading' | 'done' | 'error';

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
      job.fileStatuses = { image1: 'uploading', image2: 'uploading', video: 'uploading' };

      const videoError = await validateWatchVideoFile(job.files.video);
      if (videoError) {
        job.fileStatuses = { image1: 'error', image2: 'error', video: 'error' };
        job.status = 'error';
        job.errorMessage = videoError;
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
          fd.append('image1', job.files.image1);
          fd.append('image2', job.files.image2);
          fd.append('video', job.files.video);
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

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const apiMessage = (payload as { message?: string } | null)?.message;

          if (res.status === 401) {
            throw new Error('Tu sesión expiró. Recarga la página e intenta de nuevo.');
          }
          if (res.status === 413) {
            throw new Error('Los archivos son demasiado grandes. Usa imágenes más pequeñas o un video más corto.');
          }

          throw { statusCode: res.status, data: payload, message: apiMessage };
        }

        job.fileStatuses = { image1: 'done', image2: 'done', video: 'done' };
        job.status = 'done';

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
      } catch (err: unknown) {
        job.fileStatuses = { image1: 'error', image2: 'error', video: 'error' };
        job.status = 'error';
        job.errorMessage = extractApiErrorMessage(err, '')
          || (err instanceof Error && err.name === 'TimeoutError'
            ? 'La subida tardó demasiado. Usa un video más corto.'
            : '')
          || (err instanceof Error && err.message && !err.message.startsWith('[')
            ? err.message
            : 'No se pudo completar la subida. Revisa la conexión e intenta de nuevo.');
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
      job.fileStatuses = { image1: 'queue', image2: 'queue', video: 'queue' };
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
