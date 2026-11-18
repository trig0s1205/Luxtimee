export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  auth.hydrateStoredStaff();
  auth.hydrateTokens();
  await auth.fetchMe({ allowRefresh: false });
  if (!auth.canUsePanel) {
    return navigateTo('/vigilancia', { replace: true });
  }
});
