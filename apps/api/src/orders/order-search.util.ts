import type { Prisma } from '@prisma/client';
import { skuSearchVariants } from '@luxtime/shared';

export function buildOrderSearchWhere(
  search?: string | null,
): Prisma.OrderWhereInput | null {
  const term = search?.trim();
  if (!term) return null;

  const variants = skuSearchVariants(term);
  const skuFilters: Prisma.OrderWhereInput[] = variants.flatMap((value) => [
    {
      items: {
        some: { productSku: { contains: value, mode: 'insensitive' } },
      },
    },
    {
      items: {
        some: { watch: { sku: { contains: value, mode: 'insensitive' } } },
      },
    },
  ]);
  return {
    OR: [
      { readableId: { contains: term, mode: 'insensitive' } },
      { customerName: { contains: term, mode: 'insensitive' } },
      { customerEmail: { contains: term, mode: 'insensitive' } },
      { customerPhone: { contains: term, mode: 'insensitive' } },
      {
        items: {
          some: { productName: { contains: term, mode: 'insensitive' } },
        },
      },
      ...skuFilters,
    ],
  };
}
