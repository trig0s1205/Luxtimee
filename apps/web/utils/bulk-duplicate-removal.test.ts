import assert from 'node:assert/strict';
import test from 'node:test';
import { duplicateRemovalNote, planDuplicatePairRemoval } from './bulk-duplicate-removal';
import { assignExistingWatchImages } from './watch-image-swap';

const pairs = [
  { id: 'a', hasBack: true },
  { id: 'b', hasBack: true },
  { id: 'c', hasBack: false },
];

test('quita el par completo si solo una foto está repetida', () => {
  const plan = planDuplicatePairRemoval([{ pairId: 'a', side: 'back' }], pairs);
  assert.deepEqual(plan.removePairIds, ['a']);
  assert.deepEqual(plan.partialPairIds, ['a']);
  assert.match(duplicateRemovalNote(plan.partialPairIds.length), /par completo/);
});

test('no marca parcial cuando frente y dorso se quitan juntos', () => {
  const plan = planDuplicatePairRemoval(
    [
      { pairId: 'b', side: 'front' },
      { pairId: 'b', side: 'back' },
    ],
    pairs,
  );
  assert.deepEqual(plan.removePairIds, ['b']);
  assert.deepEqual(plan.partialPairIds, []);
});

test('una sola foto no avisa de par', () => {
  const plan = planDuplicatePairRemoval([{ pairId: 'c', side: 'front' }], pairs);
  assert.deepEqual(plan.removePairIds, ['c']);
  assert.deepEqual(plan.partialPairIds, []);
  assert.equal(duplicateRemovalNote(0), '');
});

test('el intercambio persiste frente, dorso y slots', () => {
  const next = assignExistingWatchImages(
    {
      primaryImageUrl: '/uploads/front.webp',
      secondaryImageUrl: '/uploads/back.webp',
      frontImageUrl: '/uploads/front.webp',
      backImageUrl: '/uploads/back.webp',
      images: ['/uploads/front.webp', '/uploads/back.webp'],
    },
    '/uploads/back.webp',
    '/uploads/front.webp',
  );
  assert.equal(next.frontImageUrl, '/uploads/back.webp');
  assert.equal(next.backImageUrl, '/uploads/front.webp');
  assert.deepEqual(next.images, ['/uploads/back.webp', '/uploads/front.webp']);
  assert.deepEqual(next.fingerprintSlots, [
    { imageUrl: '/uploads/back.webp', slot: 'front' },
    { imageUrl: '/uploads/front.webp', slot: 'back' },
  ]);
});

test('rechaza una url que no es del reloj', () => {
  assert.throws(
    () => assignExistingWatchImages(
      { primaryImageUrl: '/uploads/front.webp', images: ['/uploads/front.webp'] },
      'https://evil.test/a.jpg',
    ),
    /no pertenece/,
  );
});
