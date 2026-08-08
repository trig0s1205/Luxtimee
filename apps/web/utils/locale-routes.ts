export function isAdminPanelRoute(path: string) {
  return path.startsWith('/admin') || path.startsWith('/acceso/');
}

export function isStorefrontRoute(path: string) {
  return !isAdminPanelRoute(path);
}
