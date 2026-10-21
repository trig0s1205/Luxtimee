import type { WholesaleExtraDef, WholesalePackageDef } from '@luxtime/shared';
import { quoteWholesaleCart } from '@luxtime/shared';

export function useWholesaleQuote() {
  const route = useRoute();
  const api = useApi();
  const cart = useWholesaleCartStore();
  const enabled = computed(() => route.path.startsWith('/mayoristas'));

  const { data: catalog } = useAsyncData(
    'wholesale-offers-catalog',
    async () => {
      if (!enabled.value) {
        return { extras: [] as WholesaleExtraDef[], packages: [] as WholesalePackageDef[] };
      }
      return api.get<{ extras: WholesaleExtraDef[]; packages: WholesalePackageDef[] }>(
        '/wholesale-offers/catalog',
      );
    },
    { server: false, lazy: true, watch: [enabled] },
  );

  const quote = computed(() => {
    const offers = catalog.value;
    if (!offers || !cart.items.length) return null;
    try {
      return quoteWholesaleCart(
        cart.items.map((item) => ({
          watchId: item.watchId,
          quantity: item.quantity,
          wholesalePrice: item.wholesalePrice,
          extras: item.extras ?? [],
        })),
        offers.extras,
        offers.packages,
      );
    } catch {
      return null;
    }
  });

  watch(quote, (value) => {
    if (!value) return;
    cart.applyQuote(value.lines);
  });

  return { catalog, quote };
}
