/** Tope duro: si la navegación se cuelga, la barra no se queda encendida para siempre. */
const WATCHDOG_MS = 15_000;

let tickTimer: ReturnType<typeof setInterval> | null = null;
let finishTimer: ReturnType<typeof setTimeout> | null = null;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let bound = false;

export function useStorefrontRouteProgress() {
  const active = useState('sf-route-progress-active', () => false);
  const progress = useState('sf-route-progress', () => 0);

  function clearTimers() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    if (finishTimer) {
      clearTimeout(finishTimer);
      finishTimer = null;
    }
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  }

  function reset() {
    clearTimers();
    active.value = false;
    progress.value = 0;
  }

  function start() {
    if (!import.meta.client) return;
    clearTimers();
    active.value = true;
    progress.value = 0.08;
    tickTimer = setInterval(() => {
      if (progress.value < 0.9) {
        progress.value += (0.92 - progress.value) * 0.12;
      }
    }, 100);
    watchdogTimer = setTimeout(reset, WATCHDOG_MS);
  }

  function finish() {
    if (!import.meta.client) return;
    if (!active.value) {
      clearTimers();
      return;
    }
    progress.value = 1;
    clearTimers();
    finishTimer = setTimeout(reset, 320);
  }

  function bindRouter() {
    if (!import.meta.client || bound) return;
    bound = true;

    const router = useRouter();
    const nuxtApp = useNuxtApp();

    router.beforeEach((to, from) => {
      if (to.fullPath !== from.fullPath) start();
    });

    // Navegación abortada o redirigida por un middleware: la barra debe cerrarse igual.
    router.afterEach((_to, _from, failure) => {
      if (failure) finish();
    });

    router.onError(() => finish());

    nuxtApp.hook('page:loading:end', () => finish());
    nuxtApp.hook('page:finish', () => finish());
    nuxtApp.hook('app:error', () => finish());
    nuxtApp.hook('vue:error', () => finish());
  }

  return { active, progress, start, finish, bindRouter };
}
