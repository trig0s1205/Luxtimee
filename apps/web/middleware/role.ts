export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  if (!auth.loaded) {
    await auth.fetchMe();
  }
  if (!auth.isStaff) {
    return navigateTo({
      path: '/ingresar',
      query: {
        redirect: to.fullPath,
        error: 'forbidden',
      },
    });
  }
});
