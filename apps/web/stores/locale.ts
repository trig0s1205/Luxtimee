export type AppLocale = 'en' | 'es';

const STOREFRONT_STORAGE_KEY = 'luxtime-storefront-locale';
const LEGACY_STORAGE_KEY = 'luxtime-locale';

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    storefrontLocale: 'en' as AppLocale,
    hydrated: false,
  }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return;
      const saved = localStorage.getItem(STOREFRONT_STORAGE_KEY)
        ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved === 'en' || saved === 'es') this.storefrontLocale = saved;
      this.hydrated = true;
    },
    setStorefrontLocale(locale: AppLocale) {
      this.storefrontLocale = locale;
      if (import.meta.client) {
        localStorage.setItem(STOREFRONT_STORAGE_KEY, locale);
      }
    },
  },
});
