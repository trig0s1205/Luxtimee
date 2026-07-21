import en from '~/locales/en';
import es from '~/locales/es';
import type { AppLocale } from '~/stores/locale';

const catalogs = { en, es } as const;

type Catalog = typeof en;

function resolve(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function useLocale() {
  const store = useLocaleStore();
  const route = useRoute();

  const t = (key: string): string => {
    const value = resolve(catalogs[store.locale] as unknown as Record<string, unknown>, key);
    return typeof value === 'string' ? value : key;
  };

  const tm = <K extends keyof Catalog>(section: K): Catalog[K] => catalogs[store.locale][section];

  const locale = computed(() => store.locale);

  const dateLocale = computed(() => (store.locale === 'es' ? 'es-CO' : 'en-US'));

  const showSwitcher = computed(() => {
    const p = route.path;
    return (
      p === '/'
      || p.startsWith('/catalogo')
      || p.startsWith('/producto')
      || p.startsWith('/cuenta')
      || p.startsWith('/carrito')
      || p.startsWith('/checkout')
    );
  });

  function setLocale(next: AppLocale) {
    store.setLocale(next);
  }

  return { t, tm, locale, dateLocale, setLocale, showSwitcher };
}
