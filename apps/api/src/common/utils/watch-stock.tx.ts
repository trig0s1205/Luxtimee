import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { storefrontHideWhenEmpty } from './storefront-stock.util';

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
  const updated = await tx.watch.updateMany({
    where: {
      id: watchId,
      deletedAt: null,
      stock: { gte: quantity },
      ...(options?.requireActive ? { isActive: true } : {}),
    },
    data: { stock: { decrement: quantity } },
  });

  if (updated.count !== 1) {
    if (options?.requireActive) {
      const watch = await tx.watch.findUnique({
        where: { id: watchId },
        select: { isActive: true, deletedAt: true },
      });
      if (!watch?.isActive || watch.deletedAt) {
        throw new BadRequestException(
          options.inactiveMessage ?? 'Reloj no disponible',
        );
      }
    }
    throw new BadRequestException(
      options?.message ?? 'Stock insuficiente para este reloj',
    );
  }

  const watch = await tx.watch.findUnique({
    where: { id: watchId },
    select: { stock: true },
  });
  if (watch && watch.stock <= 0) {
    await tx.watch.update({
      where: { id: watchId },
      data: storefrontHideWhenEmpty(0),
    });
  }
}
