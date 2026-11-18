import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeWhatsappText,
  whatsappMessageHasLeadIn,
} from '../../../packages/shared/src/utils/whatsapp-compose';

const ADMIN_PREFIX = 'Hola LUXTIMEE';
const ADMIN_PREFIX_LONG = 'Hola LUXTIMEE, deseo comprar:';
const CONFIG_MESSAGE = 'Hola LUXTIMEE, busco un reloj en particular. Mi ciudad es ';

test('prefijo Hola LUXTIMEE + mensaje que ya empieza igual → no duplica', () => {
  const message = 'Hola LUXTIMEE, quiero comprar el reloj CARTIER. SKU: RA-489';
  assert.equal(composeWhatsappText(ADMIN_PREFIX, message), message);
  assert.equal(composeWhatsappText(ADMIN_PREFIX_LONG, message), message);
});

test('prefijo vacío → solo el mensaje', () => {
  const message = 'Hola LUXTIMEE, me gustaría recibir asesoría.';
  assert.equal(composeWhatsappText('', message), message);
  assert.equal(composeWhatsappText(null, message), message);
  assert.equal(composeWhatsappText(undefined, message), message);
});

test('mensaje sin saludo → antepone el prefijo', () => {
  assert.equal(
    composeWhatsappText(ADMIN_PREFIX_LONG, 'quiero el Submariner SKU RM-1'),
    'Hola LUXTIMEE, deseo comprar: quiero el Submariner SKU RM-1',
  );
});

test('mensaje configurado desde el admin (config.whatsappMessage) → no duplica', () => {
  assert.equal(
    composeWhatsappText(ADMIN_PREFIX, CONFIG_MESSAGE),
    CONFIG_MESSAGE,
  );
  assert.equal(
    composeWhatsappText(ADMIN_PREFIX_LONG, CONFIG_MESSAGE),
    CONFIG_MESSAGE,
  );
});

test('saludo Buenas / tildes / mayúsculas → no duplica', () => {
  assert.equal(
    composeWhatsappText(ADMIN_PREFIX, 'BUENAS, ¿tienen Cartier?'),
    'BUENAS, ¿tienen Cartier?',
  );
  assert.equal(
    composeWhatsappText(ADMIN_PREFIX, 'hólá luxtimee, consulta'),
    'hólá luxtimee, consulta',
  );
});

test('mensaje vacío → solo prefijo (si hay)', () => {
  assert.equal(composeWhatsappText(ADMIN_PREFIX, '  '), ADMIN_PREFIX);
  assert.equal(composeWhatsappText('', ''), '');
});

test('whatsappMessageHasLeadIn detecta marca al inicio', () => {
  assert.equal(whatsappMessageHasLeadIn('LUXTIMEE, deseo info'), true);
  assert.equal(whatsappMessageHasLeadIn('*✨ LUXTIMEE — pedido*'), true);
  assert.equal(whatsappMessageHasLeadIn('quiero un reloj'), false);
});
