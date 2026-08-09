export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  await auth.fetchMe();
  if (!auth.isStaff) {
    return navigateTo('/vigilancia', { replace: true });
  }
});
