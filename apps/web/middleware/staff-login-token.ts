export default defineNuxtRouteMiddleware((to) => {
  const slug = useStaffLoginSlug();
  const token = String(to.params.token ?? '');
  if (token !== slug) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
});
