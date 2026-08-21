import { defineStore } from 'pinia';
import { validateWatchVideoFile } from '~/utils/video-validation';
import { extractApiErrorMessage } from '~/utils/api-error';

export type MediaFileStatus = 'queue' | 'uploading' | 'done' | 'error';
export type MediaSlot = 'image1' | 'image2' | 'video';

export type UploadJob = {
  id: string;
  watchId: string;
  model: string;
  brandName: string;
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
      const activeJob = job;
      const toUpload = pendingSlots(activeJob);
      for (const slot of toUpload) {
        activeJob.fileStatuses[slot] = 'uploading';
      }

      const skipVideo = !toUpload.includes('video');
      let videoClientError: string | null = null;
      if (!skipVideo) {
        videoClientError = await validateWatchVideoFile(activeJob.files.video);
        if (videoClientError) {
          activeJob.fileStatuses.video = 'error';
        }
      }

      const sendSlots = toUpload.filter((slot) => slot !== 'video' || !videoClientError);

      if (sendSlots.length === 0) {
        activeJob.status = 'error';
        activeJob.errorMessage = videoClientError || 'No hay archivos pendientes para subir.';
        useToast().error(`Video inválido — ${activeJob.brandName} ${activeJob.model}`);
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
          if (sendSlots.includes('image1')) fd.append('image1', activeJob.files.image1);
          if (sendSlots.includes('image2')) fd.append('image2', activeJob.files.image2);
          if (sendSlots.includes('video')) fd.append('video', activeJob.files.video);
          return fd;
        }

        async function postUpload(token: string) {
          return fetch(`${uploadBase}/watches/${activeJob.watchId}/upload-media`, {
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
            if (activeJob.fileStatuses[slot] === 'uploading') activeJob.fileStatuses[slot] = 'error';
          }
          if (videoClientError) activeJob.fileStatuses.video = 'error';

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
            activeJob.fileStatuses[slot] = 'done';
          } else if (result?.status === 'error') {
            activeJob.fileStatuses[slot] = 'error';
            errorParts.push(`${SLOT_LABEL[slot]}: ${result.message || 'Error al procesar'}`);
          } else if (!results) {
            activeJob.fileStatuses[slot] = 'done';
          } else {
            activeJob.fileStatuses[slot] = 'error';
            errorParts.push(`${SLOT_LABEL[slot]}: No se pudo completar la subida`);
          }
        }

        if (videoClientError) {
          activeJob.fileStatuses.video = 'error';
          errorParts.push(`Video: ${videoClientError}`);
        }

        const allDone = pendingSlots(activeJob).length === 0;
        if (allDone) {
          activeJob.status = 'done';
          activeJob.errorMessage = undefined;

          useToast().success(`Multimedia lista — ${activeJob.brandName} ${activeJob.model}`);
        } else {
          activeJob.status = 'error';
          activeJob.errorMessage = errorParts.join(' · ') || videoClientError || 'Algunos archivos no se pudieron procesar.';
          const photosOk = activeJob.fileStatuses.image1 === 'done' && activeJob.fileStatuses.image2 === 'done';
          if (photosOk && activeJob.fileStatuses.video === 'error') {
            useToast().error(`Fotos listas. El video no se pudo procesar — ${activeJob.brandName} ${activeJob.model}`);
          } else {
            useToast().error(`Error multimedia — ${activeJob.brandName} ${activeJob.model}`);
          }
        }
      } catch (err: unknown) {
        for (const slot of sendSlots) {
          if (activeJob.fileStatuses[slot] === 'uploading') activeJob.fileStatuses[slot] = 'error';
        }
        if (videoClientError) activeJob.fileStatuses.video = 'error';
        activeJob.status = pendingSlots(activeJob).length === 0 ? 'done' : 'error';
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
        useToast().error(`Error multimedia — ${activeJob.brandName} ${activeJob.model}`);
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
