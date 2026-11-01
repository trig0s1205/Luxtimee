import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductWhatsappMessage } from './product-whatsapp';

test('el mensaje de compra lleva un saludo, marca, modelo y el SKU al final', () => {
  assert.equal(
    buildProductWhatsappMessage({
      brand: 'Rolex',
      model: 'Submariner',
      sku: 'RM-489',
    }),
    'Hola LUXTIMEE, quiero comprar el reloj Rolex Submariner. SKU: RM-489',
  );
});

test('no repite el modelo cuando es la misma marca o está vacío', () => {
  assert.equal(
    buildProductWhatsappMessage({
      brand: 'CARTIER',
      model: 'CARTIER',
      sku: 'RA-489',
    }),
    'Hola LUXTIMEE, quiero comprar el reloj CARTIER. SKU: RA-489',
  );
  assert.equal(
    buildProductWhatsappMessage({
      brand: 'Cartier',
      model: 'cártier',
      sku: 'RA-489',
    }),
    'Hola LUXTIMEE, quiero comprar el reloj Cartier. SKU: RA-489',
  );
  assert.equal(
    buildProductWhatsappMessage({
      brand: 'CARTIER',
      model: '   ',
      sku: 'RA-489',
    }),
    'Hola LUXTIMEE, quiero comprar el reloj CARTIER. SKU: RA-489',
  );
});
