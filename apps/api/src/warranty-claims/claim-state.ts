import { BadRequestException } from '@nestjs/common';
import { WarrantyClaimStatus } from '@prisma/client';

const CLAIM_TRANSITIONS: Record<WarrantyClaimStatus, WarrantyClaimStatus[]> = {
  [WarrantyClaimStatus.RECIBIDO]: [
    WarrantyClaimStatus.EN_REVISION,
    WarrantyClaimStatus.RECHAZADO,
  ],
  [WarrantyClaimStatus.EN_REVISION]: [
    WarrantyClaimStatus.REPARADO,
    WarrantyClaimStatus.REEMPLAZADO,
    WarrantyClaimStatus.RECHAZADO,
  ],
  [WarrantyClaimStatus.REPARADO]: [WarrantyClaimStatus.ENTREGADO],
  [WarrantyClaimStatus.REEMPLAZADO]: [WarrantyClaimStatus.ENTREGADO],
  [WarrantyClaimStatus.RECHAZADO]: [WarrantyClaimStatus.ENTREGADO],
  [WarrantyClaimStatus.ENTREGADO]: [],
};

export function getClaimAllowedTransitions(
  from: WarrantyClaimStatus,
): WarrantyClaimStatus[] {
  return CLAIM_TRANSITIONS[from] ?? [];
}

export function assertClaimTransition(
  from: WarrantyClaimStatus,
  to: WarrantyClaimStatus,
): void {
  if (!getClaimAllowedTransitions(from).includes(to)) {
    throw new BadRequestException(`Transición inválida: ${from} → ${to}`);
  }
}
