import type { Prisma } from '@prisma/client';
import { skuSearchVariants } from '@luxtime/shared';

export function buildWatchTextSearchOr(
  term: string,
  skuIds: string[] = [],
): Prisma.WatchWhereInput[] {
  const variants = skuSearchVariants(term);
  return [
    { model: { contains: term, mode: 'insensitive' } },
    { reference: { contains: term, mode: 'insensitive' } },
    { brand: { name: { contains: term, mode: 'insensitive' } } },
    ...variants.map(
      (value): Prisma.WatchWhereInput => ({
        sku: { contains: value, mode: 'insensitive' },
      }),
    ),
    ...(skuIds.length ? [{ id: { in: skuIds } }] : []),
  ];
}
