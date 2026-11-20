import assert from 'node:assert/strict';
import test from 'node:test';
import { cartHasBlockedStock, lineStockBlocked } from './pos-cart-stock';

test('bloquea línea sin stock o con cantidad mayor al stock', () => {
  assert.equal(lineStockBlocked({ stock: 0, quantity: 1 }), true);
  assert.equal(lineStockBlocked({ stock: 1, quantity: 2 }), true);
  assert.equal(lineStockBlocked({ stock: 2, quantity: 2 }), false);
});

test('el carrito se bloquea si alguna línea no alcanza', () => {
  assert.equal(
    cartHasBlockedStock([
      { stock: 3, quantity: 1 },
      { stock: 1, quantity: 2 },
    ]),
    true,
  );
  assert.equal(cartHasBlockedStock([{ stock: 4, quantity: 1 }]), false);
});
