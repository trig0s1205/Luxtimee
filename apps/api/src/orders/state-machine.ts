import { BadRequestException } from '@nestjs/common';
import { OrderStage, OrderStatus } from '@prisma/client';
import { getOrderAllowedTransitions } from '@luxtime/shared';

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

export function assertValidTransition(
  current: OrderStatus,
  next: OrderStatus,
  isNational = false,
) {
  const allowed = getOrderAllowedTransitions(current, isNational);
  if (!allowed.some((status) => status === next)) {
    throw new BadRequestException(`Transición inválida: ${current} → ${next}`);
  }
}

export function nextStatusAfterDeposit(): OrderStatus {
  return OrderStatus.PENDIENTE;
}
