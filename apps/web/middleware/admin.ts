export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  auth.hydrateTokens();
  await auth.fetchMe({ allowRefresh: true });

  if (!auth.user || (auth.user.role !== 'ADMIN' && auth.user.role !== 'SUPER_ADMIN')) {
    const { loginPath } = useStaffLoginPath();
    return navigateTo(loginPath({ redirect: to.fullPath }), { replace: true });
  }
});
