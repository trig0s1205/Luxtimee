import type { Prisma } from '@prisma/client';
import { nextDocumentSequence } from '../common/utils/document-counter.util';

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
  const finder = tx.documentCounter?.findUnique?.bind(tx.documentCounter);
  let seed = 1;
  if (finder) {
    const existing = await finder({
      where: { key: RECEIPT_COUNTER_KEY },
      select: { lastValue: true },
    });
    if (!existing) {
      const rows = await tx.$queryRaw<Array<{ max_seq: number | null }>>`
        SELECT COALESCE(MAX("sequence"), 0) AS max_seq FROM "SaleReceipt"
      `;
      const maxExisting = Number(rows[0]?.max_seq ?? 0);
      seed = Number.isFinite(maxExisting) && maxExisting >= 1 ? maxExisting + 1 : 1;
    }
  }
  return nextDocumentSequence(tx, RECEIPT_COUNTER_KEY, seed);
}
