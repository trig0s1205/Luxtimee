import assert from 'node:assert/strict';
import test from 'node:test';
import { isWatchIncomplete } from './watch-readiness';

const complete = {
  model: 'Santos',
  retailPrice: 100,
  wholesalePrice: 80,
  stock: 0,
  categoryId: 'cat',
  gender: 'Unisex',
  description: 'Reloj',
  movementType: 'Cuarzo',
  primaryImageUrl: 'a',
  secondaryImageUrl: 'b',
  videoUrl: 'v',
};

test('stock cero es agotado, no incompleto', () => {
  assert.equal(isWatchIncomplete(complete), false);
});

test('sin descripción o sin video queda incompleto', () => {
  assert.equal(isWatchIncomplete({ ...complete, description: '  ' }), true);
  assert.equal(isWatchIncomplete({ ...complete, videoUrl: '' }), true);
  assert.equal(isWatchIncomplete({ ...complete, model: 'Pendiente de completar' }), true);
});
