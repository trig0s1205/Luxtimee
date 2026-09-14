export function useStorefrontRouteProgress() {
  const active = useState('sf-route-progress-active', () => false);
  const progress = useState('sf-route-progress', () => 0);

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    if (finishTimer) {
      clearTimeout(finishTimer);
      finishTimer = null;
    }
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
  }

  function finish() {
    if (!import.meta.client) return;
    progress.value = 1;
    clearTimers();
    finishTimer = setTimeout(() => {
      active.value = false;
      progress.value = 0;
    }, 320);
  }

  function bindRouter() {
    if (!import.meta.client) return;
    const router = useRouter();
    const nuxtApp = useNuxtApp();

    router.beforeEach((to, from) => {
      if (to.fullPath !== from.fullPath) start();
    });

    nuxtApp.hook('page:finish', () => {
      if (active.value) finish();
    });
  }

  return { active, progress, start, finish, bindRouter };
}
