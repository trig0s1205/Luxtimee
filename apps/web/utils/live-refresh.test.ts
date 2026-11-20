import assert from 'node:assert/strict';
import test from 'node:test';
import { nextLiveRefreshDelay, shouldRunLiveRefresh } from './live-refresh';

test('intervalo base y backoff hasta 60s', () => {
  assert.equal(nextLiveRefreshDelay(20_000, 20_000, false), 20_000);
  assert.equal(nextLiveRefreshDelay(20_000, 20_000, true), 40_000);
  assert.equal(nextLiveRefreshDelay(20_000, 40_000, true), 60_000);
  assert.equal(nextLiveRefreshDelay(20_000, 60_000, true), 60_000);
  assert.equal(nextLiveRefreshDelay(20_000, 60_000, false), 20_000);
  assert.equal(nextLiveRefreshDelay(0, 0, true), 0);
});

test('no corre si está oculto, pausado, deshabilitado o en vuelo', () => {
  assert.equal(
    shouldRunLiveRefresh({ visible: true, paused: false, enabled: true, inflight: false }),
    true,
  );
  assert.equal(
    shouldRunLiveRefresh({ visible: false, paused: false, enabled: true, inflight: false }),
    false,
  );
  assert.equal(
    shouldRunLiveRefresh({ visible: true, paused: true, enabled: true, inflight: false }),
    false,
  );
  assert.equal(
    shouldRunLiveRefresh({ visible: true, paused: false, enabled: true, inflight: true }),
    false,
  );
});
