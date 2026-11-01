export function formatUnreadBadge(count: number) {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

export function adminTabTitle(base: string, unread: number) {
  const badge = formatUnreadBadge(unread);
  return badge ? `(${badge}) Luxtimee Admin` : base;
}

export const ADMIN_TITLE_BY_PATH: Record<string, string> = {
  '/admin': 'Administración — LUXTIMEE',
  '/admin/inventario': 'Inventario — LUXTIMEE',
  '/admin/auditoria': 'Auditoría — LUXTIMEE',
  '/admin/catalog-settings': 'Catálogo — LUXTIMEE',
  '/admin/configuracion': 'Configuración — LUXTIMEE',
  '/admin/cuidados': 'Cuidados — LUXTIMEE',
  '/admin/envios': 'Envíos — LUXTIMEE',
  '/admin/garantias': 'Garantías — LUXTIMEE',
  '/admin/multimedia': 'Multimedia — LUXTIMEE',
  '/admin/notificaciones': 'Notificaciones — LUXTIMEE',
  '/admin/pedidos': 'Pedidos — LUXTIMEE',
  '/admin/pedidos/detal': 'Pedidos al detal — LUXTIMEE',
  '/admin/pedidos/mayor': 'Pedidos al por mayor — LUXTIMEE',
  '/admin/pedidos/especiales': 'Ventas especiales — LUXTIMEE',
  '/admin/pending-costs': 'Costos pendientes — LUXTIMEE',
  '/admin/pending-info': 'Pendientes de info — LUXTIMEE',
  '/admin/pre-pedidos': 'Pre-pedidos — LUXTIMEE',
  '/admin/pre-pedidos/activos': 'Pre-pedidos activos — LUXTIMEE',
  '/admin/pre-pedidos/suspendidos': 'Pre-pedidos suspendidos — LUXTIMEE',
  '/admin/pre-pedidos/nuevo': 'Nuevo pre-pedido — LUXTIMEE',
  '/admin/resenas': 'Reseñas — LUXTIMEE',
  '/admin/secretaria': 'Secretaría — LUXTIMEE',
  '/admin/socios-mayoristas': 'Socios mayoristas — LUXTIMEE',
  '/admin/ventas': 'Ventas — LUXTIMEE',
  '/admin/whatsapp': 'WhatsApp — LUXTIMEE',
  '/admin/mayorista-ofertas': 'Ofertas mayorista — LUXTIMEE',
  '/admin/dashboards/analytics': 'Tráfico web — LUXTIMEE',
  '/admin/dashboards/ganancia': 'Ganancia — LUXTIMEE',
  '/admin/dashboards/salud': 'Salud del negocio — LUXTIMEE',
};

const PUBLIC_DOCUMENT_TITLES = new Set([
  '',
  'LUXTIMEE — Relojes de lujo',
  'Relojes de lujo en Bucaramanga y Piedecuesta | LUXTIMEE',
]);

export function adminTitleForPath(path: string) {
  const clean = (path.split('?')[0] ?? path).replace(/\/+$/, '') || '/admin';
  return ADMIN_TITLE_BY_PATH[clean] ?? 'Administración — LUXTIMEE';
}

export function adminPageLabel(title: string | undefined, fallback: string) {
  const raw = (title ?? '').replace(/\s+/g, ' ').trim();
  const source = !raw || PUBLIC_DOCUMENT_TITLES.has(raw) ? fallback : raw;
  return source
    .replace(/\s+—\s+Luxtimee Admin$/i, '')
    .replace(/\s+—\s+LUXTIMEE Admin$/i, '')
    .replace(/\s+—\s+LUXTIMEE$/i, '')
    .trim() || 'Administración';
}

export function adminDocumentTitle(title: string | undefined, unread: number, fallback: string) {
  if (formatUnreadBadge(unread)) return adminTabTitle(fallback, unread);
  return `${adminPageLabel(title, fallback)} — Luxtimee Admin`;
}
