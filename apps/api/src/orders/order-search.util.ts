import { Prisma } from '@prisma/client';
import { skuSearchVariants } from '@luxtime/shared';
import { escapeLikeTerm } from '../common/utils/watch-text-search.util';
import type { PrismaService } from '../prisma/prisma.service';

export function foldedOrderSearchTerms(search?: string | null) {
  const raw = search?.trim() ?? '';
  if (!raw) return null;
  const compactSource = raw.replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  return {
    folded: escapeLikeTerm(raw),
    compact: escapeLikeTerm(compactSource),
    skus: [...new Set(skuSearchVariants(raw).map((value) => escapeLikeTerm(value)))],
  };
}

function skuLikeSql(patterns: string[]) {
  if (!patterns.length) return Prisma.empty;
  const parts = patterns.map(
    (pattern) => Prisma.sql`
      luxtime_fold(coalesce(i."productSku", '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(w.sku, '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(o."specialSkuSnapshot", '')) LIKE ${pattern} ESCAPE '\\'
    `,
  );
  return Prisma.sql`OR (${Prisma.join(parts, ' OR ')})`;
}

/** Ids de pedidos cuyo cliente, nota, marca, modelo o SKU coinciden sin distinguir mayúsculas ni tildes. */
export async function findOrderIdsByTextSearch(
  prisma: PrismaService,
  search?: string | null,
): Promise<string[] | null> {
  const terms = foldedOrderSearchTerms(search);
  if (!terms) return null;

  const pattern = `%${terms.folded}%`;
  const compactPattern = `%${terms.compact}%`;
  const skuFilter = skuLikeSql(terms.skus.map((sku) => `%${sku}%`));

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT o.id
    FROM "Order" o
    LEFT JOIN "OrderItem" i ON i."orderId" = o.id
    LEFT JOIN "Watch" w ON w.id = i."watchId"
    LEFT JOIN "Brand" b ON b.id = w."brandId"
    WHERE
      luxtime_fold(o."readableId") LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(o."customerName") LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(o."customerEmail", '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(o."customerPhone", '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(o."specialNote", '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(i."productName", '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(i."productSku", '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(i."productRef", '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(w.model, '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(w.sku, '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(w.reference, '')) LIKE ${pattern} ESCAPE '\\'
      OR luxtime_fold(coalesce(b.name, '')) LIKE ${pattern} ESCAPE '\\'
      OR (
        ${terms.compact} <> ''
        AND (
          luxtime_fold(regexp_replace(coalesce(i."productSku", ''), '[^[:alnum:]]', '', 'g')) LIKE ${compactPattern} ESCAPE '\\'
          OR luxtime_fold(regexp_replace(coalesce(w.sku, ''), '[^[:alnum:]]', '', 'g')) LIKE ${compactPattern} ESCAPE '\\'
          OR luxtime_fold(regexp_replace(coalesce(o."specialSkuSnapshot", ''), '[^[:alnum:]]', '', 'g')) LIKE ${compactPattern} ESCAPE '\\'
        )
      )
      ${skuFilter}
  `;

  return rows.map((row) => row.id);
}
