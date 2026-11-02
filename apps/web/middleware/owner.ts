export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore();
  if (!auth.isSuperAdmin) {
    throw createError({ statusCode: 403, message: 'Solo Super Admin' });
  }
});
