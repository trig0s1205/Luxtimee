export default defineNuxtPlugin(() => {
  useLocaleStore().hydrate();
});
