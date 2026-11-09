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
  return nextDocumentSequence(tx, RECEIPT_COUNTER_KEY, 1);
}
