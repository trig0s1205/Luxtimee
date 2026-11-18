import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createScanDetector,
  looksLikeSku,
  normalizeScannedCode,
} from './barcode-scan';

test('6 teclas a 10 ms + Enter → scan', () => {
  const d = createScanDetector({ maxInterKeyMs: 40, minLength: 3 });
  let t = 1_000;
  for (const ch of 'RM-001') {
    assert.equal(d.push(ch, t), null);
    t += 10;
  }
  assert.deepEqual(d.push('Enter', t), { type: 'scan', code: 'RM-001' });
});

test('mismas teclas a 150 ms → manual', () => {
  const d = createScanDetector({ maxInterKeyMs: 40, minLength: 3 });
  let t = 1_000;
  for (const ch of 'RM-001') {
    assert.equal(d.push(ch, t), null);
    t += 150;
  }
  assert.deepEqual(d.push('Enter', t), { type: 'manual', text: 'RM-001' });
});

test('2 caracteres rápidos + Enter → manual', () => {
  const d = createScanDetector({ maxInterKeyMs: 40, minLength: 3 });
  assert.equal(d.push('R', 1000), null);
  assert.equal(d.push('M', 1010), null);
  assert.deepEqual(d.push('Enter', 1020), { type: 'manual', text: 'RM' });
});

test('Backspace reinicia', () => {
  const d = createScanDetector();
  d.push('R', 1000);
  d.push('Backspace', 1010);
  assert.equal(d.push('M', 1020), null);
  assert.deepEqual(d.push('Enter', 1030), { type: 'manual', text: 'M' });
});

test('looksLikeSku', () => {
  assert.equal(looksLikeSku('rm-001'), true);
  assert.equal(looksLikeSku('Casio'), false);
});

test('normalizeScannedCode', () => {
  assert.equal(normalizeScannedCode(' rp-1234 '), 'RP-1234');
});
