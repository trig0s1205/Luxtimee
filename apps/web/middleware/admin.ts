const SESSION_TTL_MS = 60_000;

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Navegación interna admin → cero checks, cero API
  if (import.meta.client && from.path.startsWith('/admin') && to.path.startsWith('/admin')) {
    return;
  }

  const auth = useAuthStore();
  auth.hydrateLocal();

  const sessionFresh = auth.loaded
    && auth.isAuthenticated
    && auth.isStaff
    && Date.now() - auth.sessionCheckedAt <= SESSION_TTL_MS;

  if (sessionFresh) return;

  if (!auth.loaded || Date.now() - auth.sessionCheckedAt > SESSION_TTL_MS) {
    await auth.fetchMe({ allowRefresh: false });
  }

  if (!auth.isAuthenticated || !auth.isStaff) {
    return navigateTo('/vigilancia', { replace: true });
  }
});
