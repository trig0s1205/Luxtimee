import type { Prisma } from '@prisma/client';

export const RECEIPT_PREFIX = 'LXT-';
export const RECEIPT_COUNTER_KEY = 'SALE_RECEIPT';

export function formatReceiptNumber(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error('La secuencia del comprobante debe ser un entero ≥ 1');
  }
  return `${RECEIPT_PREFIX}${String(seq).padStart(6, '0')}`;
}

/**
 * Debe llamarse dentro de la misma transacción que crea el SaleReceipt:
 * el bloqueo de fila serializa emisiones concurrentes y un rollback no deja huecos.
 */
export async function nextReceiptSequence(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "DocumentCounter" ("key", "lastValue", "updatedAt")
    VALUES (${RECEIPT_COUNTER_KEY}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE
      SET "lastValue" = "DocumentCounter"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"
  `;
  const value = rows[0]?.lastValue;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('No se pudo obtener el consecutivo del comprobante');
  }
  return value;
}
