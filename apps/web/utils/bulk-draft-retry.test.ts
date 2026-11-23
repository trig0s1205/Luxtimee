import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BULK_DRAFT_MISSING_PHOTO,
  BULK_DRAFT_RETRY_BASE_MS,
  bulkDraftPhotosMissing,
  bulkDraftRetryDelayMs,
  bulkDraftUploadErrorMessage,
  decideBulkDraftRetry,
} from './bulk-draft-retry';

test('reintenta errores de red y 5xx con las esperas fijas y jitter', () => {
  assert.deepEqual(BULK_DRAFT_RETRY_BASE_MS, [2_000, 4_000, 8_000, 16_000, 30_000]);
  assert.equal(bulkDraftRetryDelayMs(0, 0), 2_000);
  assert.equal(bulkDraftRetryDelayMs(0, 1), 2_400);
  assert.equal(bulkDraftRetryDelayMs(4, 0), 30_000);
  assert.deepEqual(
    decideBulkDraftRetry({ attempt: 0, isTypeError: true }, 0),
    { action: 'retry', delayMs: 2_000 },
  );
  assert.deepEqual(
    decideBulkDraftRetry({ attempt: 1, errorName: 'TimeoutError' }, 0),
    { action: 'retry', delayMs: 4_000 },
  );
  assert.deepEqual(
    decideBulkDraftRetry({ attempt: 2, errorName: 'AbortError' }, 0),
    { action: 'retry', delayMs: 8_000 },
  );
  for (const status of [500, 502, 503, 504]) {
    assert.equal(decideBulkDraftRetry({ attempt: 3, status }, 0).action, 'retry');
  }
  assert.equal(decideBulkDraftRetry({ attempt: 5, isTypeError: true }, 0).action, 'fail');
  assert.equal(decideBulkDraftRetry({ attempt: 5, status: 503 }, 0).action, 'fail');
});

test('un 4xx que no es 401 ni 429 falla al momento y la red caída pausa', () => {
  for (const status of [400, 403, 404, 408, 413, 422]) {
    assert.equal(decideBulkDraftRetry({ attempt: 0, status }).action, 'fail');
  }
  assert.equal(decideBulkDraftRetry({ attempt: 0, status: 401 }).action, 'fail');
  assert.equal(decideBulkDraftRetry({ attempt: 0, status: 429 }).action, 'fail');
  assert.deepEqual(
    decideBulkDraftRetry({ attempt: 3, offline: true, isTypeError: true }),
    { action: 'pause' },
  );
  assert.equal(decideBulkDraftRetry({ attempt: 0, offline: true, status: 400 }).action, 'fail');
});

test('detecta fotos vacías y el 400 de imagen faltante', () => {
  assert.equal(bulkDraftPhotosMissing(null), true);
  assert.equal(bulkDraftPhotosMissing({ front: { size: 0 }, back: null }), true);
  assert.equal(bulkDraftPhotosMissing({ front: { size: 10 }, back: { size: 0 } }), true);
  assert.equal(bulkDraftPhotosMissing({ front: { size: 10 }, back: null }), false);
  assert.equal(bulkDraftPhotosMissing({ front: { size: 10 }, back: { size: 4 } }), false);
  assert.equal(
    bulkDraftUploadErrorMessage(400, { message: 'Falta la imagen del frente' }),
    BULK_DRAFT_MISSING_PHOTO,
  );
  assert.equal(bulkDraftUploadErrorMessage(400, { message: 'SKU duplicado' }), null);
  assert.equal(bulkDraftUploadErrorMessage(500, { message: 'falta la imagen' }), null);
});
