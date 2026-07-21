export type AppLocale = 'en' | 'es';

const STORAGE_KEY = 'luxtime-locale';

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: 'en' as AppLocale,
    hydrated: false,
  }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'es') this.locale = saved;
      this.hydrated = true;
    },
    setLocale(locale: AppLocale) {
      this.locale = locale;
      if (import.meta.client) localStorage.setItem(STORAGE_KEY, locale);
    },
  },
});
