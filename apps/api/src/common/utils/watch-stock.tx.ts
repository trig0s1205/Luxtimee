import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const STOCK_TRANSACTION = {
  maxWait: 5_000,
  timeout: 20_000,
} as const;

type StockLine = { watchId: string; quantity: number };

export function aggregateStockLines(lines: StockLine[]): StockLine[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.watchId || line.quantity <= 0) continue;
    totals.set(line.watchId, (totals.get(line.watchId) ?? 0) + line.quantity);
  }
  return [...totals.entries()].map(([watchId, quantity]) => ({
    watchId,
    quantity,
  }));
}

async function applyStockDelta(
  tx: Prisma.TransactionClient,
  items: StockLine[],
  direction: 'reserve' | 'restore',
  requireActive: boolean,
) {
  const ids = items.map((item) => item.watchId);
  const qtys = items.map((item) => item.quantity);
  const activeSql = requireActive ? 'AND w."isActive" = true' : '';
  const stockExpr =
    direction === 'reserve' ? 'w.stock - v.qty' : 'w.stock + v.qty';
  const stockGuard =
    direction === 'reserve' ? 'AND w.stock >= v.qty' : '';
  const deletedGuard = direction === 'reserve' ? 'AND w."deletedAt" IS NULL' : '';
  const statusExpr =
    direction === 'reserve'
      ? `CASE WHEN (w.stock - v.qty) <= 0 THEN 'AGOTADO'::"WatchStatus" ELSE w.status END`
      : `CASE WHEN (w.stock + v.qty) > 0 THEN 'DISPONIBLE'::"WatchStatus" ELSE w.status END`;

  return tx.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "Watch" AS w
     SET stock = ${stockExpr},
         status = ${statusExpr}
     FROM (SELECT * FROM unnest($1::text[], $2::int[]) AS t(id, qty)) AS v
     WHERE w.id = v.id
       ${deletedGuard}
       ${stockGuard}
       ${activeSql}
     RETURNING w.id`,
    ids,
    qtys,
  );
}

async function throwReserveFailure(
  tx: Prisma.TransactionClient,
  items: StockLine[],
  updatedIds: Set<string>,
  options?: {
    message?: string;
    requireActive?: boolean;
    inactiveMessage?: string;
  },
): Promise<never> {
  if (options?.requireActive) {
    const missing = items
      .filter((item) => !updatedIds.has(item.watchId))
      .map((item) => item.watchId);
    const watches = await tx.watch.findMany({
      where: { id: { in: missing } },
      select: { isActive: true, deletedAt: true },
    });
    if (watches.some((watch) => !watch.isActive || watch.deletedAt)) {
      throw new BadRequestException(
        options.inactiveMessage ?? 'Reloj no disponible',
      );
    }
  }
  throw new BadRequestException(
    options?.message ?? 'Stock insuficiente para este reloj',
  );
}

export async function reserveWatchStock(
  tx: Prisma.TransactionClient,
  lines: StockLine[],
  options?: {
    message?: string;
    requireActive?: boolean;
    inactiveMessage?: string;
  },
) {
  const items = aggregateStockLines(lines);
  if (!items.length) return;
  const rows = await applyStockDelta(
    tx,
    items,
    'reserve',
    !!options?.requireActive,
  );
  if (rows.length !== items.length) {
    await throwReserveFailure(
      tx,
      items,
      new Set(rows.map((row) => row.id)),
      options,
    );
  }
}

export async function restoreWatchStock(
  tx: Prisma.TransactionClient,
  lines: StockLine[],
) {
  const items = aggregateStockLines(lines);
  if (!items.length) return;
  const rows = await applyStockDelta(tx, items, 'restore', false);
  if (rows.length !== items.length) {
    throw new BadRequestException('No se pudo reponer el stock');
  }
}

export async function decrementWatchStock(
  tx: Prisma.TransactionClient,
  watchId: string,
  quantity: number,
  options?: {
    message?: string;
    requireActive?: boolean;
    inactiveMessage?: string;
  },
) {
  await reserveWatchStock(tx, [{ watchId, quantity }], options);
}
