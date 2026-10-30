import { Prisma } from '@prisma/client';
import { skuSearchVariants } from '@luxtime/shared';
import type { PrismaService } from '../../prisma/prisma.service';

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

export async function findWatchIdsByTextSearch(
  prisma: PrismaService,
  input: {
    search: string;
    brand?: string;
    status?: string;
    skip: number;
    take: number;
  },
) {
  const term = escapeLikeTerm(input.search.trim());
  const compact = escapeLikeTerm(input.search.replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, ''));
  const pattern = `%${term}%`;
  const compactPattern = `%${compact}%`;
  const brand = input.brand?.trim() || null;
  const status = input.status?.trim() || null;

  const filters = Prisma.sql`
    w."deletedAt" IS NULL
    AND (${brand}::text IS NULL OR lower(b.slug) = lower(${brand}))
    AND (${status}::text IS NULL OR w.status::text = ${status})
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
  `;
  const rank = Prisma.sql`
    CASE
      WHEN ${compact} <> '' AND luxtime_fold(regexp_replace(w.sku, '[^[:alnum:]]', '', 'g')) = ${compact} THEN 0
      WHEN luxtime_fold(w.model) = ${term} THEN 1
      WHEN luxtime_fold(b.name) = ${term} THEN 2
      ELSE 3
    END
  `;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT w.id
      FROM "Watch" w
      INNER JOIN "Brand" b ON b.id = w."brandId"
      WHERE ${filters}
      ORDER BY ${rank}, w."createdAt" DESC
      LIMIT ${input.take} OFFSET ${input.skip}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM "Watch" w
      INNER JOIN "Brand" b ON b.id = w."brandId"
      WHERE ${filters}
    `,
  ]);

  return {
    ids: rows.map((row) => row.id),
    total: Number(totals[0]?.count ?? 0),
  };
}
