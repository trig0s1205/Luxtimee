import { BadRequestException } from '@nestjs/common';
import { WarrantyClaimStatus } from '@prisma/client';
import {
  assertClaimTransition,
  getClaimAllowedTransitions,
} from './claim-state';

const ALL = Object.values(WarrantyClaimStatus);

describe('assertClaimTransition', () => {
  const valid: Array<[WarrantyClaimStatus, WarrantyClaimStatus]> = [
    [WarrantyClaimStatus.RECIBIDO, WarrantyClaimStatus.EN_REVISION],
    [WarrantyClaimStatus.RECIBIDO, WarrantyClaimStatus.RECHAZADO],
    [WarrantyClaimStatus.EN_REVISION, WarrantyClaimStatus.REPARADO],
    [WarrantyClaimStatus.EN_REVISION, WarrantyClaimStatus.REEMPLAZADO],
    [WarrantyClaimStatus.EN_REVISION, WarrantyClaimStatus.RECHAZADO],
    [WarrantyClaimStatus.REPARADO, WarrantyClaimStatus.ENTREGADO],
    [WarrantyClaimStatus.REEMPLAZADO, WarrantyClaimStatus.ENTREGADO],
    [WarrantyClaimStatus.RECHAZADO, WarrantyClaimStatus.ENTREGADO],
  ];

  it.each(valid)('permite %s → %s', (from, to) => {
    expect(() => assertClaimTransition(from, to)).not.toThrow();
  });

  it('ENTREGADO no tiene salidas', () => {
    expect(getClaimAllowedTransitions(WarrantyClaimStatus.ENTREGADO)).toEqual(
      [],
    );
  });

  it('rechaza transiciones inválidas', () => {
    for (const from of ALL) {
      const allowed = new Set(getClaimAllowedTransitions(from));
      for (const to of ALL) {
        if (allowed.has(to)) continue;
        expect(() => assertClaimTransition(from, to)).toThrow(
          BadRequestException,
        );
      }
    }
  });
});
