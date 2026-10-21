import { defineStore } from 'pinia';

export type BulkDeleteStatus = 'queued' | 'running' | 'done' | 'error';

export type BulkDeleteJob = {
  id: string;
  model: string;
  brandName: string;
  status: BulkDeleteStatus;
  progress: number;
};

const CONCURRENCY = 3;

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
      this._tick();
    },

    _tick() {
      while (this._running < CONCURRENCY) {
        const job = this.jobs.find((item) => item.status === 'queued');
        if (!job) return;
        job.status = 'running';
        job.progress = 12;
        this._running += 1;
        void this._run(job);
      }
    },

    async _run(job: BulkDeleteJob) {
      const timer = setInterval(() => {
        if (job.status === 'running' && job.progress < 88) job.progress += 7;
      }, 180);
      try {
        await useApi().del(`/watches/${job.id}`);
        job.progress = 100;
        job.status = 'done';
      } catch {
        job.status = 'error';
      } finally {
        clearInterval(timer);
        this._running = Math.max(0, this._running - 1);
        this._tick();
      }
    },

    clearFinished() {
      this.jobs = this.jobs.filter((job) => job.status === 'queued' || job.status === 'running');
    },
  },
});
