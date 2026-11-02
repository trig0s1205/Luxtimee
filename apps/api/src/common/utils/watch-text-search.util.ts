import { Prisma } from '@prisma/client';
import { skuSearchVariants } from '@luxtime/shared';
import type { PrismaService } from '../../prisma/prisma.service';
import { DRAFT_WATCH_MODEL } from '../../watches/utils/watch-pending.util';

const ACCENTS = 'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ';
const FOLDED = 'aaaaaaeeeeiiiiooooouuuuncyy';

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

export function foldSearchText(value: string) {
  const map = new Map([...ACCENTS].map((char, index) => [char, FOLDED[index] ?? char]));
  return [...value.toLowerCase()].map((char) => map.get(char) ?? char).join('');
}

export function escapeLikeTerm(value: string) {
  return foldSearchText(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Reloj publicado, con ficha completa y unidades. El inventario no usa este filtro. */
export function sellableWatchSql() {
  return Prisma.sql`
    AND w."isActive" = true
    AND w."isPublished" = true
    AND w.stock > 0
    AND btrim(w.model) <> ''
    AND w.model <> ${DRAFT_WATCH_MODEL}
    AND w."categoryId" IS NOT NULL
    AND btrim(coalesce(w.gender, '')) <> ''
    AND btrim(coalesce(w.description, '')) <> ''
    AND w."retailPrice" > 0
    AND w."wholesalePrice" > 0
    AND (
      btrim(coalesce(w."primaryImageUrl", '')) <> ''
      OR btrim(coalesce(w."frontImageUrl", '')) <> ''
      OR coalesce(cardinality(w.images), 0) >= 1
    )
    AND (
      btrim(coalesce(w."secondaryImageUrl", '')) <> ''
      OR btrim(coalesce(w."backImageUrl", '')) <> ''
      OR coalesce(cardinality(w.images), 0) >= 2
    )
    AND btrim(coalesce(w."videoUrl", '')) <> ''
    AND (
      btrim(coalesce(w."movementType", '')) <> ''
      OR w."mechanismId" IS NOT NULL
    )
  `;
}

export async function findWatchIdsByTextSearch(
  prisma: PrismaService,
  input: {
    search?: string;
    brand?: string;
    status?: string;
    sellable?: boolean;
    skip: number;
    take: number;
  },
) {
  const rawSearch = input.search?.trim() ?? '';
  const hasSearch = rawSearch.length > 0;
  const term = escapeLikeTerm(rawSearch);
  const compact = escapeLikeTerm(rawSearch.replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, ''));
  const pattern = `%${term}%`;
  const compactPattern = `%${compact}%`;
  const brand = input.brand?.trim() || null;
  const status = input.status?.trim() || null;

  const filters = Prisma.sql`
    w."deletedAt" IS NULL
    AND (${brand}::text IS NULL OR lower(b.slug) = lower(${brand}))
    AND (${status}::text IS NULL OR w.status::text = ${status})
  `;
  const textFilter = hasSearch
    ? Prisma.sql`
      AND (
        luxtime_fold(w.model) LIKE ${pattern} ESCAPE '\\'
        OR luxtime_fold(b.name) LIKE ${pattern} ESCAPE '\\'
        OR luxtime_fold(w.sku) LIKE ${pattern} ESCAPE '\\'
        OR luxtime_fold(coalesce(w.reference, '')) LIKE ${pattern} ESCAPE '\\'
        OR (
          ${compact} <> ''
          AND luxtime_fold(regexp_replace(w.sku, '[^[:alnum:]]', '', 'g')) LIKE ${compactPattern} ESCAPE '\\'
        )
      )
    `
    : Prisma.empty;
  const sellableFilter = input.sellable ? sellableWatchSql() : Prisma.empty;
  const orderBy = hasSearch
    ? Prisma.sql`
      ORDER BY
        CASE
          WHEN ${compact} <> '' AND luxtime_fold(regexp_replace(w.sku, '[^[:alnum:]]', '', 'g')) = ${compact} THEN 0
          WHEN luxtime_fold(w.model) = ${term} THEN 1
          WHEN luxtime_fold(b.name) = ${term} THEN 2
          ELSE 3
        END,
        w."createdAt" DESC
    `
    : Prisma.sql`ORDER BY w."createdAt" DESC`;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT w.id
      FROM "Watch" w
      INNER JOIN "Brand" b ON b.id = w."brandId"
      WHERE ${filters}
      ${textFilter}
      ${sellableFilter}
      ${orderBy}
      LIMIT ${input.take} OFFSET ${input.skip}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM "Watch" w
      INNER JOIN "Brand" b ON b.id = w."brandId"
      WHERE ${filters}
      ${textFilter}
      ${sellableFilter}
    `,
  ]);

  return {
    ids: rows.map((row) => row.id),
    total: Number(totals[0]?.count ?? 0),
  };
}
