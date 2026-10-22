import { defineStore } from 'pinia';

export type BulkDeleteStatus = 'queued' | 'running' | 'done' | 'error';

export type BulkDeleteJob = {
  id: string;
  model: string;
  brandName: string;
  status: BulkDeleteStatus;
  progress: number;
};

const BATCH_SIZE = 500;

type BulkDeleteResponse = {
  deletedIds: string[];
  missingIds: string[];
};

export const useWatchBulkDeleteStore = defineStore('watchBulkDelete', {
  state: () => ({
    jobs: [] as BulkDeleteJob[],
    _running: 0,
  }),
  getters: {
    pendingCount: (state) =>
      state.jobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
    doneCount: (state) => state.jobs.filter((job) => job.status === 'done').length,
    failedCount: (state) => state.jobs.filter((job) => job.status === 'error').length,
    activeJobs: (state) => state.jobs.filter((job) => job.status !== 'done'),
  },
  actions: {
    enqueue(items: Array<{ id: string; model: string; brandName: string }>) {
      for (const item of items) {
        const existing = this.jobs.find((job) => job.id === item.id);
        if (existing && (existing.status === 'queued' || existing.status === 'running' || existing.status === 'done')) {
          continue;
        }
        if (existing?.status === 'error') {
          existing.status = 'queued';
          existing.progress = 0;
          existing.model = item.model;
          existing.brandName = item.brandName;
          continue;
        }
        this.jobs.push({
          id: item.id,
          model: item.model,
          brandName: item.brandName,
          status: 'queued',
          progress: 0,
        });
      }
      this._pump();
    },

    _pump() {
      if (this._running) return;
      const batch = this.jobs.filter((job) => job.status === 'queued').slice(0, BATCH_SIZE);
      if (!batch.length) return;
      this._running = 1;
      void this._runBatch(batch);
    },

    async _runBatch(batch: BulkDeleteJob[]) {
      for (const job of batch) {
        job.status = 'running';
        job.progress = 30;
      }
      const timer = setInterval(() => {
        for (const job of batch) {
          if (job.status === 'running' && job.progress < 88) job.progress += 7;
        }
      }, 180);
      try {
        const res = await useApi().post<BulkDeleteResponse>('/watches/bulk-delete', {
          ids: batch.map((job) => job.id),
        });
        const deleted = new Set(res.deletedIds ?? []);
        for (const job of batch) {
          if (deleted.has(job.id)) {
            job.progress = 100;
            job.status = 'done';
          } else {
            job.status = 'error';
          }
        }
      } catch {
        for (const job of batch) job.status = 'error';
      } finally {
        clearInterval(timer);
        this._running = 0;
        this._pump();
      }
    },

    clearFinished() {
      this.jobs = this.jobs.filter((job) => job.status === 'queued' || job.status === 'running');
    },
  },
});
