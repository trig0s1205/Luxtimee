export type OrderStatusValue =
  | 'PENDIENTE'
  | 'PAGADO'
  | 'ENVIADO'
  | 'ENTREGADO'
  | 'CANCELADO';

const BASE_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  PENDIENTE: ['PAGADO', 'CANCELADO'],
  PAGADO: ['ENVIADO'],
  ENVIADO: ['ENTREGADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDIENTE: 'Pendiente',
  PAGADO: 'Pagado',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const ORDER_TRANSITION_LABELS: Record<OrderStatusValue, string> = {
  PENDIENTE: 'Marcar pendiente',
  PAGADO: 'Confirmar pago',
  ENVIADO: 'Marcar como enviado',
  ENTREGADO: 'Marcar como entregado',
  CANCELADO: 'Cancelar pedido',
};

export function getOrderAllowedTransitions(
  current: OrderStatusValue | null | undefined,
  isNational = false,
): OrderStatusValue[] {
  if (!current) return [];
  const base = BASE_TRANSITIONS[current] ?? [];
  if (current === 'PAGADO' && !isNational) {
    return ['ENTREGADO'];
  }
  return base;
}

export function statusBadgeTone(
  status: OrderStatusValue | null | undefined,
): 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado' | 'gold' {
  switch (status) {
    case 'PENDIENTE':
      return 'pendiente';
    case 'PAGADO':
      return 'pagado';
    case 'ENVIADO':
      return 'enviado';
    case 'ENTREGADO':
      return 'entregado';
    case 'CANCELADO':
      return 'cancelado';
    default:
      return 'gold';
  }
}
