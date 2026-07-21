import { Role } from '@luxtime/shared';

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  if (!auth.loaded) {
    await auth.fetchMe();
  }
  if (!auth.isAuthenticated || auth.user?.role !== Role.CUSTOMER) {
    return navigateTo({
      path: '/ingresar',
      query: { redirect: to.fullPath },
    });
  }
});
