import { ORDER_STATUS_LABELS, type OrderStatusValue } from '@luxtime/shared';

export type StaffNotification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

function readable(payload: Record<string, unknown>) {
  const id = payload.readableId;
  return typeof id === 'string' && id ? `#${id}` : '';
}

export function notificationMessage(type: string, payload: Record<string, unknown>) {
  const ref = readable(payload);
  switch (type) {
    case 'NEW_PRE_ORDER':
      return ref ? `Nuevo prepedido ${ref}` : 'Nuevo prepedido';
    case 'PRE_ORDER_REMINDER':
      return ref
        ? `Prepedido ${ref} lleva más de 2 horas sin atender`
        : 'Un prepedido lleva más de 2 horas sin atender';
    case 'PRE_ORDER_CONFIRMED':
      return ref ? `Abono confirmado en ${ref}` : 'Abono confirmado';
    case 'PRE_ORDER_SUSPENDED':
      return ref ? `Prepedido ${ref} quedó suspendido` : 'Un prepedido quedó suspendido';
    case 'PRE_ORDER_REACTIVATED':
      return ref ? `Prepedido ${ref} fue reactivado` : 'Un prepedido fue reactivado';
    case 'ORDER_STATUS_CHANGED': {
      const status = typeof payload.status === 'string' ? payload.status : '';
      const label = status in ORDER_STATUS_LABELS
        ? ORDER_STATUS_LABELS[status as OrderStatusValue]
        : status || 'otro estado';
      return ref ? `Pedido ${ref} cambió a ${label}` : `Un pedido cambió a ${label}`;
    }
    default:
      return 'Nueva notificación';
  }
}

export function notificationHref(type: string, payload: Record<string, unknown>) {
  const orderId = typeof payload.orderId === 'string' ? payload.orderId : '';
  const query = orderId ? `?id=${encodeURIComponent(orderId)}` : '';
  if (type === 'PRE_ORDER_SUSPENDED') return `/admin/pre-pedidos/suspendidos${query}`;
  if (type === 'NEW_PRE_ORDER' || type === 'PRE_ORDER_REMINDER' || type === 'PRE_ORDER_REACTIVATED') {
    return `/admin/pre-pedidos/activos${query}`;
  }
  if (type === 'PRE_ORDER_CONFIRMED' || type === 'ORDER_STATUS_CHANGED') {
    return `/admin/pedidos/detal${query}`;
  }
  return '/admin/notificaciones';
}

export function notificationTone(type: string): 'success' | 'info' | 'warning' {
  if (type === 'NEW_PRE_ORDER' || type === 'PRE_ORDER_CONFIRMED') return 'success';
  if (type === 'PRE_ORDER_REMINDER' || type === 'PRE_ORDER_SUSPENDED') return 'warning';
  return 'info';
}

export function formatRelativeTime(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return minutes === 1 ? 'hace 1 min' : `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'hace 1 h' : `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
