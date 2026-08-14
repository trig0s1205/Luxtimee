export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  auth.hydrateTokens();
  await auth.fetchMe({ allowRefresh: false });
  if (!auth.isAuthenticated) {
    const { loginPath } = useStaffLoginPath();
    return navigateTo(loginPath({ redirect: to.fullPath }), { replace: true });
  }
});
