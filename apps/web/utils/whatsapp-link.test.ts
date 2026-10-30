import assert from 'node:assert/strict';
import test from 'node:test';
import { whatsappPhoneFromInput, whatsappUrlFromInput } from '../../../packages/shared/src/utils/whatsapp-link';

test('acepta el número, el celular local y un enlace wa.me', () => {
  assert.equal(whatsappPhoneFromInput('3001234567'), '573001234567');
  assert.equal(whatsappPhoneFromInput('+57 300 123 4567'), '573001234567');
  assert.equal(whatsappUrlFromInput('https://wa.me/573001234567'), 'https://wa.me/573001234567');
  assert.equal(whatsappUrlFromInput('https://api.whatsapp.com/send?phone=573001234567&text=hola'), 'https://wa.me/573001234567');
  assert.equal(whatsappPhoneFromInput('123'), null);
});
