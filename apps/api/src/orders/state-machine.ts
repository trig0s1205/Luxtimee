import { BadRequestException } from '@nestjs/common';
import { OrderStage, OrderStatus } from '@prisma/client';

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDIENTE: [OrderStatus.PAGADO, OrderStatus.CANCELADO],
  PAGADO: [OrderStatus.ENVIADO],
  ENVIADO: [OrderStatus.ENTREGADO],
  ENTREGADO: [],
  CANCELADO: [],
};

export function assertPreOrderEditable(stage: OrderStage, canceledAt: Date | null) {
  if (stage !== OrderStage.PRE_ORDER || canceledAt) {
    throw new BadRequestException('Solo se pueden editar pre-pedidos activos');
  }
}

export function assertCanConfirmDeposit(
  stage: OrderStage,
  depositConfirmed: boolean,
  canceledAt: Date | null,
) {
  if (stage !== OrderStage.PRE_ORDER || depositConfirmed || canceledAt) {
    throw new BadRequestException('No se puede confirmar el abono de este pre-pedido');
  }
}

export function assertValidTransition(current: OrderStatus, next: OrderStatus) {
  const allowed = ORDER_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new BadRequestException(`Transición inválida: ${current} → ${next}`);
  }
}

export function nextStatusAfterDeposit(): OrderStatus {
  return OrderStatus.PENDIENTE;
}
