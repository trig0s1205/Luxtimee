import assert from 'node:assert/strict';
import test from 'node:test';
import type { WatchPublicDto } from '@luxtime/shared';
import { buildWatchTechSpecs, isCustomerSpecKey } from './watch-tech-sheet';

test('no muestra claves internas de specs', () => {
  assert.equal(isCustomerSpecKey('bulkDraftIdempotencyKey'), false);
  assert.equal(isCustomerSpecKey('_internal'), false);
  assert.equal(isCustomerSpecKey('caseMaterial'), true);

  const rows = buildWatchTechSpecs({
    sku: 'RM-489',
    model: 'Datejust',
    brand: { id: '1', name: 'Rolex', slug: 'rolex' },
    movementType: 'Automático',
    specs: {
      bulkDraftIdempotencyKey: 'batch-secret',
      caseMaterial: 'Acero',
    },
  } as unknown as WatchPublicDto);

  assert.equal(rows.some((row) => /idempotency|bulk draft/i.test(row.label)), false);
  assert.equal(rows.some((row) => row.value === 'batch-secret'), false);
  assert.equal(rows.some((row) => row.value === 'Acero'), true);
});
