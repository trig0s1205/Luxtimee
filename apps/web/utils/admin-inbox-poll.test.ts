import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_INBOX_HIDDEN_MS,
  ADMIN_INBOX_VISIBLE_MS,
  createAdminInboxPoll,
} from './admin-inbox-poll';

function fakeClock() {
  let now = 0;
  let seq = 1;
  const timers = new Map<number, { fn: () => void; ms: number; next: number }>();

  return {
    setInterval(fn: () => void, ms: number) {
      const id = seq++;
      timers.set(id, { fn, ms, next: now + ms });
      return id;
    },
    clearInterval(id: number) {
      timers.delete(id);
    },
    advance(ms: number) {
      const target = now + ms;
      while (now < target) {
        let nextAt = target;
        for (const timer of timers.values()) {
          if (timer.next < nextAt) nextAt = timer.next;
        }
        now = nextAt;
        for (const timer of [...timers.values()]) {
          if (timer.next === now) {
            timer.next += timer.ms;
            timer.fn();
          }
        }
      }
    },
    size() {
      return timers.size;
    },
  };
}

test('con la pestaña visible sondea cada 30s', () => {
  const clock = fakeClock();
  const calls: boolean[] = [];
  const poll = createAdminInboxPoll({
    tick: (force) => calls.push(force),
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
  });

  poll.start(false);
  assert.deepEqual(calls, [false]);
  clock.advance(ADMIN_INBOX_VISIBLE_MS);
  assert.deepEqual(calls, [false, false]);
  clock.advance(ADMIN_INBOX_VISIBLE_MS - 1);
  assert.equal(calls.length, 2);
  clock.advance(1);
  assert.equal(calls.length, 3);
});

test('al ocultarse sigue sondeando cada 60s y al volver hace tick inmediato a 30s', () => {
  const clock = fakeClock();
  const calls: boolean[] = [];
  const poll = createAdminInboxPoll({
    tick: (force) => calls.push(force),
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
  });

  poll.start(false);
  poll.onVisibility(true);
  assert.deepEqual(calls, [false]);

  clock.advance(ADMIN_INBOX_HIDDEN_MS - 1);
  assert.equal(calls.length, 1);
  clock.advance(1);
  assert.deepEqual(calls, [false, false]);

  clock.advance(5 * 60_000);
  assert.equal(calls.length, 7);
  assert.ok(calls.every((force) => force === false));
  assert.equal(clock.size(), 1);

  poll.onVisibility(false);
  assert.equal(calls.at(-1), true);
  const before = calls.length;
  clock.advance(ADMIN_INBOX_VISIBLE_MS);
  assert.equal(calls.length, before + 1);
  assert.equal(calls.at(-1), false);
});

test('detener el sondeo cancela el intervalo oculto', () => {
  const clock = fakeClock();
  const calls: boolean[] = [];
  const poll = createAdminInboxPoll({
    tick: (force) => calls.push(force),
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
  });

  poll.start(true);
  poll.stop();
  clock.advance(ADMIN_INBOX_HIDDEN_MS * 3);
  assert.deepEqual(calls, [false]);
  assert.equal(clock.size(), 0);
  poll.onVisibility(false);
  assert.deepEqual(calls, [false]);
});
