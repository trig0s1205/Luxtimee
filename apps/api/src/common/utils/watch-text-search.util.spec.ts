import type { Prisma } from '@prisma/client';
import { buildWatchTextSearchOr, escapeLikeTerm, foldSearchText, sellableWatchSql } from './watch-text-search.util';

function containedSkus(or: Prisma.WatchWhereInput[]) {
  return or.flatMap((clause) => {
    const sku = clause.sku;
    if (!sku || typeof sku !== 'object' || !('contains' in sku)) return [];
    return typeof sku.contains === 'string' ? [sku.contains] : [];
  });
}

describe('buildWatchTextSearchOr', () => {
  it('incluye el SKU con y sin guion', () => {
    const or = buildWatchTextSearchOr('RM-489', ['watch-1']);
    const skuClauses = containedSkus(or);
    expect(skuClauses).toEqual(expect.arrayContaining(['RM-489', 'RM489']));
    expect(or).toEqual(expect.arrayContaining([{ id: { in: ['watch-1'] } }]));
  });

  it('encuentra rm 489 como RM-489', () => {
    const or = buildWatchTextSearchOr('rm 489');
    const skuClauses = containedSkus(or);
    expect(skuClauses).toEqual(expect.arrayContaining(['RM489', 'RM-489']));
  });

  it('iguala mayúsculas y tildes', () => {
    expect(foldSearchText('CÁRTIER')).toBe('cartier');
    expect(foldSearchText('Cartier')).toBe(foldSearchText('cártier'));
  });

  it('escapa comodines del LIKE', () => {
    expect(escapeLikeTerm('100%_á')).toBe('100\\%\\_a');
  });
});

describe('sellableWatchSql', () => {
  it('exige catálogo publicado, ficha completa y stock', () => {
    const sql = sellableWatchSql();
    const text = sql.strings.join(' ');
    expect(text).toContain('w."isPublished" = true');
    expect(text).toContain('w."isActive" = true');
    expect(text).toContain('w.stock > 0');
    expect(text).toContain('w."videoUrl"');
    expect(text).toContain('w."categoryId" IS NOT NULL');
    expect(sql.values).toContain('Pendiente de completar');
  });
});
