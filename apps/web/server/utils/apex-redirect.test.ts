import assert from 'node:assert/strict';
import test from 'node:test';
import { apexRedirectTarget, requestHost } from './apex-redirect';

test('el apex va a www y conserva path y query', () => {
  assert.equal(
    apexRedirectTarget('luxtimee.com', '/acceso/slug', '?next=/admin'),
    'https://www.luxtimee.com/acceso/slug?next=/admin',
  );
  assert.equal(apexRedirectTarget('luxtimee.com:443', '/', ''), 'https://www.luxtimee.com/');
});

test('www, localhost y un host parecido no redirigen', () => {
  assert.equal(apexRedirectTarget('www.luxtimee.com', '/admin', ''), null);
  assert.equal(apexRedirectTarget('localhost', '/', ''), null);
  assert.equal(apexRedirectTarget('luxtimee.com.evil.test', '/', ''), null);
  assert.equal(requestHost('luxtimee.com, www.luxtimee.com', '127.0.0.1:3000'), 'luxtimee.com');
  assert.equal(requestHost(undefined, 'www.luxtimee.com'), 'www.luxtimee.com');
});
