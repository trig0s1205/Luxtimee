import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStaffLoginSlug } from './staff-login';

test('slug de staff: producción sin variable queda cerrado', () => {
  assert.equal(resolveStaffLoginSlug(undefined, 'production'), '');
  assert.equal(resolveStaffLoginSlug('  ', 'production'), '');
  assert.equal(resolveStaffLoginSlug('portal-real', 'production'), 'portal-real');
});

test('slug de staff: desarrollo usa el valor o el default local', () => {
  assert.equal(resolveStaffLoginSlug(undefined, 'development'), 'dev-portal-lx9k2');
  assert.equal(resolveStaffLoginSlug('otro', 'test'), 'otro');
});
