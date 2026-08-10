export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();

  // SIEMPRE verificar con el API - sin excepciones
  await auth.fetchMe({ allowRefresh: true });

  // Si no hay usuario autenticado o no es staff → fuera
  if (!auth.user || (auth.user.role !== 'ADMIN' && auth.user.role !== 'SUPER_ADMIN')) {
    return navigateTo('/vigilancia', { replace: true });
  }
});
