export default defineNuxtRouteMiddleware(async () => {
  const { fetchSession, isAuthed } = useWholesaleSession();

  if (import.meta.client) {
    await fetchSession();
  }

  if (!isAuthed.value) {
    return navigateTo('/mayoristas');
  }
});
