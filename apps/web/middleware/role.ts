export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  auth.hydrateTokens();
  await auth.fetchMe({ allowRefresh: false });
  if (!auth.isStaff) {
    return navigateTo('/vigilancia', { replace: true });
  }
});
