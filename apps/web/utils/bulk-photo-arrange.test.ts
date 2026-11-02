import assert from 'node:assert/strict';
import test from 'node:test';
import {
  moveItem,
  pairInOrder,
  selectionBadge,
  sortByNaturalName,
  toggleSelection,
} from './bulk-photo-arrange';

test('ordena nombres de WhatsApp en secuencia natural', () => {
  const names = [
    'IMG-20261101-WA0010.jpg',
    'IMG-20261101-WA0002.jpg',
    'IMG-20261101-WA0001.jpg',
  ].map((name) => ({ name }));
  assert.deepEqual(
    sortByNaturalName(names).map((item) => item.name),
    [
      'IMG-20261101-WA0001.jpg',
      'IMG-20261101-WA0002.jpg',
      'IMG-20261101-WA0010.jpg',
    ],
  );
});

test('el clic asigna frente y dorso y deseleccionar renumera', () => {
  const once = toggleSelection([], 'a');
  const twice = toggleSelection(once, 'b');
  const thrice = toggleSelection(twice, 'c');
  assert.deepEqual(thrice, ['a', 'b', 'c']);
  assert.deepEqual(selectionBadge(0), { n: 1, role: 'frente' });
  assert.deepEqual(selectionBadge(1), { n: 2, role: 'dorso' });
  assert.deepEqual(selectionBadge(2), { n: 3, role: 'frente' });
  const undone = toggleSelection(thrice, 'b');
  assert.deepEqual(undone, ['a', 'c']);
  assert.equal(selectionBadge(1).role, 'dorso');
});

test('empareja en orden y deja la foto impar aparte', () => {
  const ten = pairInOrder([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(ten.pairs.length, 5);
  assert.deepEqual(ten.pairs[0], { front: 1, back: 2 });
  assert.deepEqual(ten.pairs[4], { front: 9, back: 10 });
  assert.equal(ten.leftover, null);
  const odd = pairInOrder(['f1', 'd1', 'sola']);
  assert.deepEqual(odd.pairs, [{ front: 'f1', back: 'd1' }]);
  assert.equal(odd.leftover, 'sola');
});

test('mover un reloj intercambia con el vecino', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 0, -1), ['a', 'b']);
});
