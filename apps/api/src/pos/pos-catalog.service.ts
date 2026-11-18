import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PosCatalogFacetsDto,
  PosCatalogPageDto,
  PosCatalogWatchDto,
  PosWatchDto,
} from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';
import { escapeLikeTerm } from '../common/utils/watch-text-search.util';
import { PosCatalogQueryDto } from './dto/pos.dto';

const POS_WATCH_SELECT = {
  id: true,
  sku: true,
  model: true,
  reference: true,
  limitedEditionNumber: true,
  retailPrice: true,
  stock: true,
  warrantyMonths: true,
  isActive: true,
  frontImageUrl: true,
  primaryImageUrl: true,
  secondaryImageUrl: true,
  backImageUrl: true,
  images: true,
  mainImageIndex: true,
  gender: true,
  dialColor: true,
  strapMaterial: true,
  caseMaterial: true,
  movementType: true,
  createdAt: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
} as const;

type PosWatchRow = Prisma.WatchGetPayload<{ select: typeof POS_WATCH_SELECT }>;

export function posSellableWhere(): Prisma.WatchWhereInput {
  return {
    deletedAt: null,
    isActive: true,
    stock: { gt: 0 },
  };
}

function clean(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return undefined;
  return trimmed;
}

function normalizeSkuCode(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

export function buildPosGallery(watch: {
  images: string[];
  mainImageIndex: number;
  frontImageUrl: string | null;
  primaryImageUrl: string | null;
  secondaryImageUrl: string | null;
  backImageUrl: string | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url?: string | null) => {
    const value = url?.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  const main = watch.images[watch.mainImageIndex];
  push(main);
  push(watch.frontImageUrl);
  push(watch.primaryImageUrl);
  push(watch.secondaryImageUrl);
  push(watch.backImageUrl);
  for (const image of watch.images) push(image);
  return out;
}

export function toPosWatchDto(watch: PosWatchRow): PosWatchDto {
  const gallery = buildPosGallery(watch);
  return {
    id: watch.id,
    sku: watch.sku,
    brandName: watch.brand.name,
    model: watch.model,
    reference: watch.reference,
    limitedEditionNumber: watch.limitedEditionNumber,
    retailPrice: watch.retailPrice,
    stock: watch.stock,
    warrantyMonths: watch.warrantyMonths,
    imageUrl: gallery[0] ?? null,
  };
}

export function toPosCatalogWatchDto(watch: PosWatchRow): PosCatalogWatchDto {
  return {
    ...toPosWatchDto(watch),
    gallery: buildPosGallery(watch),
    categoryName: watch.category?.name ?? null,
    gender: watch.gender,
    dialColor: watch.dialColor,
    strapMaterial: watch.strapMaterial,
    caseMaterial: watch.caseMaterial,
    movementType: watch.movementType,
  };
}

@Injectable()
export class PosCatalogService {
  constructor(private prisma: PrismaService) {}

  async findWatchIdsByPosSearch(
    search: string,
    options: { onlySellable?: boolean; limit?: number } = {},
  ): Promise<string[]> {
    const raw = search.trim();
    if (raw.length < 2) return [];
    const term = escapeLikeTerm(raw);
    const compact = escapeLikeTerm(
      raw.replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, ''),
    );
    const pattern = `%${term}%`;
    const compactPattern = `%${compact}%`;
    const limit = options.limit ?? 30;
    const sellable = options.onlySellable
      ? Prisma.sql`AND w."isActive" = true AND w.stock > 0`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT w.id
      FROM "Watch" w
      INNER JOIN "Brand" b ON b.id = w."brandId"
      WHERE w."deletedAt" IS NULL
        ${sellable}
        AND (
          luxtime_fold(w.sku) LIKE ${pattern} ESCAPE '\\'
          OR luxtime_fold(w.model) LIKE ${pattern} ESCAPE '\\'
          OR luxtime_fold(b.name) LIKE ${pattern} ESCAPE '\\'
          OR luxtime_fold(b.name || ' ' || w.model) LIKE ${pattern} ESCAPE '\\'
          OR luxtime_fold(coalesce(w.reference, '')) LIKE ${pattern} ESCAPE '\\'
          OR luxtime_fold(coalesce(w."limitedEditionNumber", '')) LIKE ${pattern} ESCAPE '\\'
          OR (
            ${compact} <> ''
            AND luxtime_fold(regexp_replace(w.sku, '[^[:alnum:]]', '', 'g')) LIKE ${compactPattern} ESCAPE '\\'
          )
        )
      ORDER BY
        CASE
          WHEN lower(w.sku) = lower(${raw}) THEN 0
          WHEN luxtime_fold(w.sku) = ${term} THEN 1
          ELSE 2
        END,
        b.name ASC,
        w.model ASC
      LIMIT ${limit}
    `;
    return rows.map((row) => row.id);
  }

  async findBySku(code: string): Promise<PosWatchDto> {
    const normalized = normalizeSkuCode(code);
    const watch = await this.prisma.watch.findFirst({
      where: {
        sku: { equals: normalized, mode: 'insensitive' },
        deletedAt: null,
      },
      select: POS_WATCH_SELECT,
    });
    if (!watch) {
      throw new NotFoundException(`Código no encontrado: ${normalized}`);
    }
    if (!watch.isActive) {
      throw new BadRequestException('Este reloj no está activo para la venta');
    }
    return toPosWatchDto(watch);
  }

  async searchWatches(search: string): Promise<PosWatchDto[]> {
    const ids = await this.findWatchIdsByPosSearch(search, {
      onlySellable: true,
      limit: 30,
    });
    if (!ids.length) return [];
    const watches = await this.prisma.watch.findMany({
      where: { id: { in: ids }, ...posSellableWhere() },
      select: POS_WATCH_SELECT,
    });
    const byId = new Map(watches.map((watch) => [watch.id, watch]));
    return ids
      .map((id) => byId.get(id))
      .filter((watch): watch is PosWatchRow => !!watch)
      .map(toPosWatchDto);
  }

  private async buildCatalogWhere(
    query: PosCatalogQueryDto,
  ): Promise<Prisma.WatchWhereInput> {
    const where: Prisma.WatchWhereInput = { ...posSellableWhere() };

    const brand = clean(query.brand);
    if (brand) {
      where.brand = { slug: { equals: brand, mode: 'insensitive' } };
    }
    const category = clean(query.category);
    if (category) {
      where.category = { slug: { equals: category, mode: 'insensitive' } };
    }
    const gender = clean(query.gender);
    if (gender) {
      where.gender = { equals: gender, mode: 'insensitive' };
    }
    const dialColor = clean(query.dialColor);
    if (dialColor) {
      where.dialColor = { equals: dialColor, mode: 'insensitive' };
    }
    const strapMaterial = clean(query.strapMaterial);
    if (strapMaterial) {
      where.strapMaterial = { equals: strapMaterial, mode: 'insensitive' };
    }

    const minPrice = query.minPrice;
    const maxPrice = query.maxPrice;
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException(
        'El precio mínimo no puede ser mayor que el máximo',
      );
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.retailPrice = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }

    const search = query.search?.trim();
    if (search) {
      const ids = await this.findWatchIdsByPosSearch(search, {
        onlySellable: true,
        limit: 500,
      });
      where.id = { in: ids.length ? ids : ['__none__'] };
    }

    return where;
  }

  private buildOrderBy(
    sort?: string,
  ): Prisma.WatchOrderByWithRelationInput | Prisma.WatchOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ retailPrice: 'asc' }, { createdAt: 'desc' }];
      case 'price_desc':
        return [{ retailPrice: 'desc' }, { createdAt: 'desc' }];
      case 'brand_asc':
        return [{ brand: { name: 'asc' } }, { model: 'asc' }];
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }

  async listCatalog(query: PosCatalogQueryDto): Promise<PosCatalogPageDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(48, Math.max(1, query.limit ?? 24));
    const where = await this.buildCatalogWhere(query);
    const orderBy = this.buildOrderBy(query.sort);

    const [rows, total] = await Promise.all([
      this.prisma.watch.findMany({
        where,
        select: POS_WATCH_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.watch.count({ where }),
    ]);

    return {
      items: rows.map(toPosCatalogWatchDto),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async facets(): Promise<PosCatalogFacetsDto> {
    const where = posSellableWhere();
    const [brandGroups, categoryGroups, watches, priceAgg] = await Promise.all([
      this.prisma.watch.groupBy({
        by: ['brandId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.watch.groupBy({
        by: ['categoryId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.watch.findMany({
        where,
        select: {
          gender: true,
          dialColor: true,
          strapMaterial: true,
        },
      }),
      this.prisma.watch.aggregate({
        where,
        _min: { retailPrice: true },
        _max: { retailPrice: true },
      }),
    ]);

    const brandIds = brandGroups.map((g) => g.brandId);
    const categoryIds = categoryGroups
      .map((g) => g.categoryId)
      .filter((id): id is string => !!id);

    const [brands, categories] = await Promise.all([
      brandIds.length
        ? this.prisma.brand.findMany({
            where: { id: { in: brandIds } },
            select: { id: true, slug: true, name: true },
          })
        : Promise.resolve([]),
      categoryIds.length
        ? this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, slug: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const brandById = new Map(brands.map((b) => [b.id, b]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const brandsOut = brandGroups
      .map((g) => {
        const brand = brandById.get(g.brandId);
        if (!brand) return null;
        return {
          slug: brand.slug,
          name: brand.name,
          count: g._count._all,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const categoriesOut = categoryGroups
      .map((g) => {
        if (!g.categoryId) return null;
        const category = categoryById.get(g.categoryId);
        if (!category) return null;
        return {
          slug: category.slug,
          name: category.name,
          count: g._count._all,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    return {
      brands: brandsOut,
      categories: categoriesOut,
      genders: this.groupTextFacet(watches.map((w) => w.gender)),
      dialColors: this.groupTextFacet(watches.map((w) => w.dialColor)),
      strapMaterials: this.groupTextFacet(watches.map((w) => w.strapMaterial)),
      priceRange: {
        min: priceAgg._min.retailPrice ?? 0,
        max: priceAgg._max.retailPrice ?? 0,
      },
    };
  }

  private groupTextFacet(
    values: Array<string | null | undefined>,
  ): Array<{ value: string; count: number }> {
    const map = new Map<string, { value: string; count: number }>();
    for (const raw of values) {
      const trimmed = raw?.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { value: trimmed, count: 1 });
    }
    return [...map.values()].sort((a, b) =>
      a.value.localeCompare(b.value, 'es'),
    );
  }
}
