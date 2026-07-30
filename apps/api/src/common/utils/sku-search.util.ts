import { normalizeSkuSearch } from '@luxtime/shared';
import type { PrismaService } from '../../prisma/prisma.service';

type WatchSkuFilter = {
  catalogOnly?: boolean;
};

export async function findWatchIdsByFlexibleSkuSearch(
  prisma: PrismaService,
  term: string,
  filters: WatchSkuFilter = {},
): Promise<string[]> {
  const normalized = normalizeSkuSearch(term);
  if (!normalized) return [];

  const pattern = `%${normalized}%`;

  const rows = filters.catalogOnly
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Watch"
        WHERE "deletedAt" IS NULL
          AND "isActive" = true
          AND "isPublished" = true
          AND REPLACE(REPLACE(UPPER(sku), '-', ''), ' ', '') LIKE ${pattern}
      `
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Watch"
        WHERE "deletedAt" IS NULL
          AND REPLACE(REPLACE(UPPER(sku), '-', ''), ' ', '') LIKE ${pattern}
      `;

  return rows.map((row) => row.id);
}

export async function findWarrantyHistoryIdsByFlexibleSkuSearch(
  prisma: PrismaService,
  term: string,
): Promise<string[]> {
  const normalized = normalizeSkuSearch(term);
  if (!normalized) return [];

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "WarrantyHistory"
    WHERE REPLACE(REPLACE(UPPER("productSku"), '-', ''), ' ', '') LIKE ${`%${normalized}%`}
  `;

  return rows.map((row) => row.id);
}
