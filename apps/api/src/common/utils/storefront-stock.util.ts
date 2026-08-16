import { WatchStatus } from '@prisma/client';

/** Oculta la pieza del storefront cuando no queda stock. */
export function storefrontHideWhenEmpty(stock: number) {
  if (stock > 0) return {};
  return {
    stock: 0,
    status: WatchStatus.AGOTADO,
    showInCatalog: false,
  };
}
