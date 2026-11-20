import type { MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { nextLiveRefreshDelay, shouldRunLiveRefresh } from '~/utils/live-refresh';

type LiveRefreshOptions = {
  intervalMs?: number;
  enabled?: MaybeRefOrGetter<boolean>;
  pauseWhen?: MaybeRefOrGetter<boolean>;
};

/**
 * Refresco silencioso en cliente. intervalMs 0 = solo al volver a la pestaña o a online.
 */
export function useLiveRefresh(
  refreshFn: () => Promise<void> | void,
  options: LiveRefreshOptions = {},
) {
  const base = options.intervalMs ?? 20_000;
  let delay = base;
  let inflight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function schedule() {
    clearTimer();
    if (stopped || base <= 0) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (toValue(options.pauseWhen)) return;
    if (toValue(options.enabled) === false) return;
    timer = setTimeout(() => {
      void run();
    }, delay);
  }

  async function run() {
    if (stopped || typeof document === 'undefined') return;
    const allowed = shouldRunLiveRefresh({
      visible: document.visibilityState === 'visible',
      paused: Boolean(toValue(options.pauseWhen)),
      enabled: toValue(options.enabled) !== false,
      inflight,
    });
    if (!allowed) {
      schedule();
      return;
    }
    inflight = true;
    let failed = false;
    try {
      await refreshFn();
    } catch {
      failed = true;
    } finally {
      inflight = false;
      delay = nextLiveRefreshDelay(base, delay, failed);
      schedule();
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') void run();
    else clearTimer();
  }

  function onOnline() {
    void run();
  }

  if (import.meta.client) {
    onMounted(() => {
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('online', onOnline);
      schedule();
    });
    onBeforeUnmount(() => {
      stopped = true;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    });
    watch(
      () => Boolean(toValue(options.pauseWhen)) || toValue(options.enabled) === false,
      (hold) => {
        if (hold) clearTimer();
        else schedule();
      },
    );
  }

  return {
    trigger: () => run(),
  };
}
