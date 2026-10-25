export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    useLocaleStore().hydrate();
  });
});
