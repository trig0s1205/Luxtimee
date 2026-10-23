import {
  normalizeResumedBulkDraftJob,
  retryFailedBulkDraftJobs,
  swapBulkDraftPairSides,
  swapBulkDraftStoredSides,
} from '@luxtime/shared';

function job(
  id: string,
  status: 'queued' | 'running' | 'done' | 'error',
  idempotencyKey = `${id}-key`,
) {
  return {
    id,
    status,
    progress: status === 'running' ? 40 : status === 'done' ? 100 : 12,
    errorMessage: status === 'error' ? 'falló' : undefined,
    idempotencyKey,
    frontName: `${id}-a.jpg`,
  };
}

describe('cola de carga por fotos', () => {
  it('al reanudar, un par en curso vuelve a la cola y uno listo se queda', () => {
    expect(normalizeResumedBulkDraftJob(job('1', 'running'))).toMatchObject({
      status: 'queued',
      progress: 0,
      idempotencyKey: '1-key',
    });
    expect(normalizeResumedBulkDraftJob(job('2', 'done'))).toMatchObject({
      status: 'done',
      progress: 100,
    });
    expect(normalizeResumedBulkDraftJob(job('3', 'error'))).toMatchObject({
      status: 'error',
      progress: 0,
      errorMessage: 'falló',
    });
  });

  it('reintenta todos los fallos y no reenvía los que ya van en curso', () => {
    const jobs = [
      job('ok', 'done'),
      job('run', 'running', 'same'),
      job('wait', 'queued'),
      job('bad', 'error', 'same'),
      job('other', 'error', 'other'),
    ];
    const next = retryFailedBulkDraftJobs(jobs);
    expect(next).not.toBe(jobs);
    expect(next.map((item) => [item.id, item.status, item.idempotencyKey])).toEqual([
      ['ok', 'done', 'ok-key'],
      ['run', 'running', 'same'],
      ['wait', 'queued', 'wait-key'],
      ['bad', 'error', 'same'],
      ['other', 'queued', 'other'],
    ]);
    expect(next[4]).toMatchObject({ progress: 0, errorMessage: undefined, frontName: 'other-a.jpg' });
    expect(retryFailedBulkDraftJobs(next)).toBe(next);
  });

  it('intercambia frente y dorso de un par sin mover los demás', () => {
    const first = {
      id: '1',
      batchId: 'lote',
      frontName: '15.jpeg',
      backName: '16.jpeg',
      idempotencyKey: 'lote:15.jpeg|16.jpeg',
      frontSortAt: 10,
      backSortAt: 20,
      frontSortSource: 'modifiedAt' as const,
      backSortSource: 'createdAt' as const,
      frontUrl: 'blob:frente',
      backUrl: 'blob:dorso',
    };
    const second = {
      id: '2',
      batchId: 'lote',
      frontName: '17.jpeg',
      backName: '18.jpeg',
      idempotencyKey: 'lote:17.jpeg|18.jpeg',
      frontSortAt: 30,
      backSortAt: 40,
      frontSortSource: 'createdAt' as const,
      backSortSource: 'createdAt' as const,
      frontUrl: 'blob:a',
      backUrl: 'blob:b',
    };
    const swapped = swapBulkDraftPairSides(first);
    expect(swapped).toMatchObject({
      id: '1',
      frontName: '16.jpeg',
      backName: '15.jpeg',
      idempotencyKey: 'lote:16.jpeg|15.jpeg',
      frontSortAt: 20,
      backSortAt: 10,
      frontSortSource: 'createdAt',
      backSortSource: 'modifiedAt',
      frontUrl: 'blob:dorso',
      backUrl: 'blob:frente',
    });
    expect(second.frontName).toBe('17.jpeg');
    expect(swapBulkDraftPairSides(swapped).idempotencyKey).toBe(first.idempotencyKey);
    expect(swapBulkDraftStoredSides({
      front: 'A',
      back: 'B',
      frontType: 'image/jpeg',
      backType: 'image/png',
    })).toEqual({
      front: 'B',
      back: 'A',
      frontType: 'image/png',
      backType: 'image/jpeg',
    });
  });

  it('el reintento de un par no toca el resto', () => {
    const jobs = [job('a', 'error'), job('b', 'error'), job('c', 'running')];
    const next = retryFailedBulkDraftJobs(jobs, new Set(['b']));
    expect(next.map((item) => [item.id, item.status])).toEqual([
      ['a', 'error'],
      ['b', 'queued'],
      ['c', 'running'],
    ]);
  });
});
