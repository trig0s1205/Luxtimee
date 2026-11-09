import type { Prisma } from '@prisma/client';
import { todayBogotaYmd } from '../../receipts/bogota-time.util';

/**
 * Incremento atómico de DocumentCounter dentro de la misma tx.
 * El INSERT inicial usa `seed`; en conflicto solo hace lastValue + 1.
 * Un rollback de la tx no consume número.
 */
export async function nextDocumentSequence(
  tx: Prisma.TransactionClient,
  key: string,
  seed = 1,
): Promise<number> {
  if (!Number.isInteger(seed) || seed < 1) {
    throw new Error('La semilla del contador debe ser un entero ≥ 1');
  }
  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "DocumentCounter" ("key", "lastValue", "updatedAt")
    VALUES (${key}, ${seed}, NOW())
    ON CONFLICT ("key") DO UPDATE
      SET "lastValue" = "DocumentCounter"."lastValue" + 1,
          "updatedAt" = NOW()
    RETURNING "lastValue"
  `;
  const value = rows[0]?.lastValue;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`No se pudo obtener el consecutivo para ${key}`);
  }
  return value;
}

export function orderReadableIdKey(ymdCompact: string): string {
  return `ORDER_LX_${ymdCompact}`;
}

export function bogotaYmdCompact(now = new Date()): string {
  return todayBogotaYmd(now).replace(/-/g, '');
}

export function formatOrderReadableId(
  ymdCompact: string,
  sequence: number,
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('La secuencia del pedido debe ser un entero ≥ 1');
  }
  return `LX-${ymdCompact}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Siguiente LX-YYYYMMDD-NNNN usando DocumentCounter diario (día civil Bogotá).
 * Semilla = máximo sufijo ya usado ese día + 1 (seguro tras el count() viejo).
 */
export async function nextOrderReadableId(
  tx: Prisma.TransactionClient,
  now = new Date(),
): Promise<string> {
  const ymd = bogotaYmdCompact(now);
  const key = orderReadableIdKey(ymd);
  const matchPattern = `^LX-${ymd}-[0-9]+$`;
  const capturePattern = `^LX-${ymd}-([0-9]+)$`;

  const maxRows = await tx.$queryRaw<Array<{ max_seq: number | null }>>`
    SELECT MAX(
      CAST(substring("readableId" from ${capturePattern}) AS INTEGER)
    ) AS max_seq
    FROM "Order"
    WHERE "readableId" ~ ${matchPattern}
  `;
  const maxExisting = Number(maxRows[0]?.max_seq ?? 0);
  const seed = Number.isFinite(maxExisting) && maxExisting >= 1
    ? maxExisting + 1
    : 1;

  const seq = await nextDocumentSequence(tx, key, seed);
  return formatOrderReadableId(ymd, seq);
}
