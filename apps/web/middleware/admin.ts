import { resolveAccessToken } from '~/utils/auth-token';

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  auth.hydrateTokens();

  const freshStaffSession = auth.isStaff && Date.now() - auth.sessionCheckedAt < 30_000;
  const hasStoredSession = auth.isStaff && !!resolveAccessToken(auth.accessToken);

  if (!freshStaffSession && (!auth.isStaff || hasStoredSession)) {
    await auth.fetchMe({ allowRefresh: true });
  }

  if (!auth.user || (auth.user.role !== 'ADMIN' && auth.user.role !== 'SUPER_ADMIN')) {
    return navigateTo('/vigilancia', { replace: true });
  }
});
