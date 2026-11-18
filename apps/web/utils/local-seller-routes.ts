export const LOCAL_SELLER_ROUTES = [
  '/admin/pos',
  '/admin/pos/mis-ventas',
  '/admin/pos/caja',
  '/admin/comprobantes',
] as const;

export function isLocalSellerRoute(path: string) {
  const clean = (path.split('?')[0] ?? path).replace(/\/+$/, '') || '/';
  return LOCAL_SELLER_ROUTES.some(
    (route) => clean === route || clean.startsWith(`${route}/`),
  );
}
