import { resolveAccessToken } from '~/utils/auth-token';

/** Ventana en la que la sesión se considera verificada y no se revalida. */
const SESSION_FRESH_MS = 30_000;

export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  auth.hydrateTokens();

  const freshStaffSession = auth.isStaff && Date.now() - auth.sessionCheckedAt < SESSION_FRESH_MS;
  const usableStaffSession = auth.isStaff && !!resolveAccessToken(auth.accessToken);

  if (!freshStaffSession) {
    await auth.fetchMe({ allowRefresh: true });
  }

  if (!auth.user || (auth.user.role !== 'ADMIN' && auth.user.role !== 'SUPER_ADMIN')) {
    return navigateTo('/vigilancia', { replace: true });
  }
});
