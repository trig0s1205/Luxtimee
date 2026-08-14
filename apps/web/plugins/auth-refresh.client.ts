import { resolveAccessToken } from '~/utils/auth-token';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  const router = useRouter();

  async function refreshStaffSession() {
    auth.hydrateTokens();
    if (!auth.isStaff || !resolveAccessToken(auth.accessToken)) return;
    if (!router.currentRoute.value.path.startsWith('/admin')) return;

    try {
      await auth.refreshSession();
    } catch {
      /* sigue con el token actual hasta el próximo intento */
    }
  }

  const timer = window.setInterval(() => {
    void refreshStaffSession();
  }, REFRESH_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState === 'visible') void refreshStaffSession();
  };

  document.addEventListener('visibilitychange', onVisible);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }
});
