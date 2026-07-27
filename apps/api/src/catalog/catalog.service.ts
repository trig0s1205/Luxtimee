import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private prisma: PrismaService) {}

  private normalizeMediaUrl(url?: string | null) {
    if (!url) return null;
    if (url.startsWith('/uploads')) return url;
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/uploads')) return parsed.pathname;
    } catch {
      return url;
    }
    return url;
  }

  private mapPublicWatch(watch: Record<string, unknown>) {
    const { cost, profitPercent, imageNeedsReview, ...rest } = watch;

    const primaryImageUrl = this.normalizeMediaUrl(rest.primaryImageUrl as string | null);
    const secondaryImageUrl = this.normalizeMediaUrl(rest.secondaryImageUrl as string | null);
    const videoUrl = this.normalizeMediaUrl(rest.videoUrl as string | null);
    const images = Array.isArray(rest.images)
      ? (rest.images as string[]).map((item) => this.normalizeMediaUrl(item)).filter((item): item is string => !!item)
      : [];

    const frontImageUrl =
      this.normalizeMediaUrl(rest.frontImageUrl as string | null)
      ?? primaryImageUrl
      ?? images[0]
      ?? null;

    const backImageUrl =
      this.normalizeMediaUrl(rest.backImageUrl as string | null)
      ?? secondaryImageUrl
      ?? images[1]
      ?? null;

    return {
      ...rest,
      primaryImageUrl,
      secondaryImageUrl,
      videoUrl,
      images,
      frontImageUrl,
      backImageUrl,
    };
  }

  private clean(value?: string) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.toLowerCase() === 'all') return undefined;
    return trimmed;
  }

  private buildWhere(query: CatalogQueryDto): Prisma.WatchWhereInput {
    const where: Prisma.WatchWhereInput = {
      isActive: true,
      isPublished: true,
      deletedAt: null,
    };

    const brand = this.clean(query.brand);
    if (brand) {
      where.brand = { slug: { equals: brand, mode: 'insensitive' } };
    }

    const movement = this.clean(query.movement);
    if (movement) {
      where.movementType = { equals: movement, mode: 'insensitive' };
    }

    const gender = this.clean(query.gender);
    if (gender) {
      where.gender = { equals: gender, mode: 'insensitive' };
    }

    const available = this.clean(query.available);
    if (available === 'true') {
      where.stock = { gt: 0 };
    } else if (available === 'false') {
      where.stock = 0;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.retailPrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { model: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  private buildOrderBy(sort?: string): Prisma.WatchOrderByWithRelationInput {
    switch (sort) {
      case 'oldest':
        return { createdAt: 'asc' };
      case 'price_asc':
        return { retailPrice: 'asc' };
      case 'price_desc':
        return { retailPrice: 'desc' };
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }

  async list(query: CatalogQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(200, Math.max(1, query.limit ?? 12));
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query.sort);

    this.logger.debug(`[catalog:list] query=${JSON.stringify(query)}`);
    this.logger.debug(`[catalog:list] where=${JSON.stringify(where)} orderBy=${JSON.stringify(orderBy)}`);

    const [data, total] = await Promise.all([
      this.prisma.watch.findMany({
        where,
        include: { brand: true, category: true, warrantyTemplate: true, careTemplate: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.watch.count({ where }),
    ]);

    this.logger.debug(`[catalog:list] results=${data.length} total=${total}`);

    return {
      data: data.map((w) => this.mapPublicWatch(w)),
      total,
      page,
      limit,
    };
  }

  async findBySlug(slug: string) {
    const watch = await this.prisma.watch.findFirst({
      where: { slug, isActive: true, isPublished: true, deletedAt: null },
      include: { brand: true, category: true, warrantyTemplate: true, careTemplate: true },
    });

    if (!watch) throw new NotFoundException('Producto no encontrado');
    return this.mapPublicWatch(watch);
  }

  async findBestSellers(limit = 3) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { status: { in: ['PAGADO', 'ENVIADO', 'ENTREGADO'] } },
      },
      select: { watchId: true, quantity: true },
    });
    const totals = new Map<string, number>();
    for (const item of items) {
      totals.set(item.watchId, (totals.get(item.watchId) ?? 0) + item.quantity);
    }
    const ids = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
    if (!ids.length) return [];
    const watches = await this.prisma.watch.findMany({
      where: { id: { in: ids }, isActive: true },
      include: { brand: true, category: true, warrantyTemplate: true, careTemplate: true },
    });
    return ids
      .map((id) => watches.find((w) => w.id === id))
      .filter((w): w is NonNullable<typeof w> => !!w)
      .map((w) => this.mapPublicWatch(w));
  }

  async findNewArrivals(limit = 8) {
    const watches = await this.prisma.watch.findMany({
      where: { isActive: true, isPublished: true, deletedAt: null },
      include: { brand: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return watches.map((w) => this.mapPublicWatch(w));
  }

  async findFeatured(limit = 6) {
    const watches = await this.prisma.watch.findMany({
      where: {
        isActive: true,
        isPublished: true,
        showInCatalog: true,
        deletedAt: null,
      },
      include: { brand: true, category: true, warrantyTemplate: true, careTemplate: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return watches.map((w) => this.mapPublicWatch(w));
  }
}
