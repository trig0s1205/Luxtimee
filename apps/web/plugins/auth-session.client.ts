export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  auth.hydrateTokens();
});
