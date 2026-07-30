export default defineNuxtPlugin((nuxtApp) => {
  const { fetchSession } = useWholesaleSession();

  nuxtApp.hook('app:mounted', () => {
    fetchSession();
  });

  nuxtApp.hook('page:finish', () => {
    fetchSession();
  });
});
