import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCookieHeader } from './cookie-jar';

test('rota el access y conserva el resto', () => {
  const next = mergeCookieHeader(
    'LUXTIMEE_access=old; LUXTIMEE_refresh=r1; LUXTIMEE_wholesale_token=w',
    ['LUXTIMEE_access=new; Path=/; HttpOnly; SameSite=Lax'],
  );
  assert.equal(next, 'LUXTIMEE_access=new; LUXTIMEE_refresh=r1; LUXTIMEE_wholesale_token=w');
});

test('una cookie vencida sale del jar', () => {
  const next = mergeCookieHeader(
    'LUXTIMEE_access=old; LUXTIMEE_refresh=r1',
    ['LUXTIMEE_access=; Path=/; Max-Age=0; HttpOnly'],
  );
  assert.equal(next, 'LUXTIMEE_refresh=r1');
});
