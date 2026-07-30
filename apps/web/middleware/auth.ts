export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  if (!auth.loaded) {
    await auth.fetchMe();
  }
  if (!auth.isAuthenticated) {
    return navigateTo('/ingresar');
  }
});
