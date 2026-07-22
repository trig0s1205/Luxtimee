export function isAdminPanelRoute(path: string) {
  return path.startsWith('/admin') || path.startsWith('/ingresar');
}

export function isStorefrontRoute(path: string) {
  return !isAdminPanelRoute(path);
}
