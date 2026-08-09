export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  await auth.fetchMe();
  if (!auth.isAuthenticated) {
    return navigateTo('/vigilancia', { replace: true });
  }
});
