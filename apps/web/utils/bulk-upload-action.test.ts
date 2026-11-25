import assert from 'node:assert/strict';
import test from 'node:test';
import { bulkUploadAction } from './bulk-upload-action';

test('sube todos los pares aunque sigan marcados como parecidos', () => {
  assert.equal(
    bulkUploadAction({
      confirming: false,
      pairCount: 45,
      similarityDecisions: ['pending', 'keep', 'pending'],
    }),
    'upload',
  );
});

test('no sube sin pares o mientras confirma', () => {
  assert.equal(bulkUploadAction({ confirming: false, pairCount: 0, similarityDecisions: [] }), 'noop');
  assert.equal(
    bulkUploadAction({ confirming: true, pairCount: 2, similarityDecisions: ['keep'] }),
    'noop',
  );
});
