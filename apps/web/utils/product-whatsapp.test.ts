import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductWhatsappMessage } from './product-whatsapp';

test('el mensaje de compra incluye nombre y SKU', () => {
  assert.equal(
    buildProductWhatsappMessage({
      brand: 'Rolex',
      model: 'Submariner',
      sku: 'RM-489',
    }),
    'Hola, quiero comprar Rolex Submariner. SKU: RM-489',
  );
});
