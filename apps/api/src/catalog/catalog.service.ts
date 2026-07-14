import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CatalogQuery {
  brand?: string;
  movement?: string;
  available?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  private mapPublicWatch(watch: Record<string, unknown>) {
    const { cost, profitPercent, imageNeedsReview, ...rest } = watch;
    return rest;
  }

  async list(query: CatalogQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      ...(query.brand ? { brand: { slug: query.brand } } : {}),
      ...(query.movement ? { movementType: query.movement } : {}),
      ...(query.available === 'true' ? { stock: { gt: 0 } } : {}),
      ...(query.available === 'false' ? { stock: 0 } : {}),
    };

    const orderBy =
      query.sort === 'price_asc'
        ? { retailPrice: 'asc' as const }
        : query.sort === 'price_desc'
          ? { retailPrice: 'desc' as const }
          : { createdAt: 'desc' as const };

    const [data, total] = await Promise.all([
      this.prisma.watch.findMany({
        where,
        include: { brand: true, warrantyTemplate: true, careTemplate: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.watch.count({ where }),
    ]);

    return {
      data: data.map((w) => this.mapPublicWatch(w)),
      total,
      page,
      limit,
    };
  }

  async findBySlug(slug: string) {
    const watch = await this.prisma.watch.findFirst({
      where: { slug, isActive: true },
      include: { brand: true, warrantyTemplate: true, careTemplate: true },
    });

    if (!watch) throw new NotFoundException('Producto no encontrado');
    return this.mapPublicWatch(watch);
  }

  async findNewArrivals(limit = 8) {
    const watches = await this.prisma.watch.findMany({
      where: { isActive: true },
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return watches.map((w) => this.mapPublicWatch(w));
  }
}
