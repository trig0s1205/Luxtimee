export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  auth.hydrateTokens();
  if (!auth.loaded) {
    await auth.fetchMe();
  }

  if (!auth.isAuthenticated) return;

  const { redirectAfterLogin } = useAuth();
  const requested = typeof to.query.redirect === 'string' ? to.query.redirect : null;
  return navigateTo(redirectAfterLogin(auth.user!, requested));
});
