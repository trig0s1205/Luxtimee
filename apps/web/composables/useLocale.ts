import en from '~/locales/en';
import es from '~/locales/es';
import type { AppLocale } from '~/stores/locale';
import { isAdminPanelRoute, isStorefrontRoute } from '~/utils/locale-routes';

const catalogs = { en, es } as const;

type CatalogKey = keyof typeof en;
type CatalogSection<K extends CatalogKey> = (typeof en)[K] | (typeof es)[K];

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

  const isAdmin = computed(() => isAdminPanelRoute(route.path));

  const locale = computed<AppLocale>(() =>
    isAdmin.value ? 'es' : store.storefrontLocale,
  );

  const t = (key: string): string => {
    const value = resolve(catalogs[locale.value] as unknown as Record<string, unknown>, key);
    return typeof value === 'string' ? value : key;
  };

  const tm = <K extends CatalogKey>(section: K): CatalogSection<K> =>
    catalogs[locale.value][section] as CatalogSection<K>;

  const dateLocale = computed(() => (locale.value === 'es' ? 'es-CO' : 'en-US'));

  const showSwitcher = computed(() => isStorefrontRoute(route.path));

  function setLocale(next: AppLocale) {
    if (!isStorefrontRoute(route.path)) return;
    store.setStorefrontLocale(next);
  }

  return { t, tm, locale, dateLocale, setLocale, showSwitcher, isAdmin };
}
