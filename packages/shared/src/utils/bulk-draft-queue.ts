export type BulkDraftQueueStatus = 'queued' | 'running' | 'done' | 'error';

export type BulkDraftQueueItem = {
  id?: string;
  status: BulkDraftQueueStatus;
  progress: number;
  errorMessage?: string;
  idempotencyKey: string;
};

export function normalizeResumedBulkDraftJob<T extends BulkDraftQueueItem>(job: T): T {
  return {
    ...job,
    status: job.status === 'running' ? 'queued' : job.status,
    progress: job.status === 'done' ? 100 : 0,
  };
}

/** Reencola fallos. No toca pares en curso ni repetidos por la misma clave. */
export function retryFailedBulkDraftJobs<T extends BulkDraftQueueItem>(
  jobs: readonly T[],
  onlyIds?: ReadonlySet<string>,
): readonly T[] {
  const busy = new Set<string>();
  for (const job of jobs) {
    if (job.status === 'queued' || job.status === 'running') busy.add(job.idempotencyKey);
  }
  let changed = false;
  const next = jobs.map((job) => {
    if (job.status !== 'error') return job;
    if (onlyIds && !onlyIds.has(job.id ?? '')) return job;
    if (busy.has(job.idempotencyKey)) return job;
    busy.add(job.idempotencyKey);
    changed = true;
    return {
      ...job,
      status: 'queued' as const,
      progress: 0,
      errorMessage: undefined,
    };
  });
  return changed ? next : jobs;
}
