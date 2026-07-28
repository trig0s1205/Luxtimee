import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWatchDto, UpdateWatchDto } from './dto';
import { WatchQueryDto } from './dto/watch-query.dto';

const watchInclude = {
  brand: true,
  category: true,
  warrantyTemplate: true,
  careTemplate: true,
} as const;

@Injectable()
export class WatchesRepository {
  constructor(private prisma: PrismaService) {}

  async findMany(query: WatchQueryDto) {
    const where: Prisma.WatchWhereInput = { deletedAt: null };

    if (query.brand) {
      where.brand = { slug: { equals: query.brand, mode: 'insensitive' } };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { model: { contains: term, mode: 'insensitive' } },
        { reference: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));

    const [data, total] = await Promise.all([
      this.prisma.watch.findMany({
        where,
        include: watchInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.watch.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const watch = await this.prisma.watch.findUnique({
      where: { id, deletedAt: null },
      include: watchInclude,
    });
    if (!watch) throw new NotFoundException('Reloj no encontrado');
    return watch;
  }

  async findByIdRaw(id: string) {
    return this.prisma.watch.findUnique({ where: { id, deletedAt: null } });
  }

  async findBySlug(slug: string) {
    return this.prisma.watch.findUnique({
      where: { slug, deletedAt: null },
      include: watchInclude,
    });
  }

  async findBySku(sku: string) {
    return this.prisma.watch.findUnique({
      where: { sku, deletedAt: null },
      include: watchInclude,
    });
  }

  async create(data: Prisma.WatchCreateInput) {
    return this.prisma.watch.create({
      data,
      include: watchInclude,
    });
  }

  async update(id: string, data: Prisma.WatchUpdateInput) {
    return this.prisma.watch.update({
      where: { id },
      data,
      include: watchInclude,
    });
  }

  async softDelete(id: string) {
    return this.prisma.watch.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, isPublished: false, showInCatalog: false },
      include: watchInclude,
    });
  }

  async countShowInCatalog(excludeId?: string) {
    return this.prisma.watch.count({
      where: {
        showInCatalog: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async ensureUniqueSku(sku: string) {
    let candidate = sku;
    let suffix = 1;
    while (await this.prisma.watch.findUnique({ where: { sku: candidate } })) {
      candidate = `${sku}-${suffix.toString(36).toUpperCase()}`;
      suffix++;
    }
    return candidate;
  }

  async findPendingCost() {
    return this.prisma.watch.findMany({
      where: {
        deletedAt: null,
        OR: [{ cost: null }, { cost: 0 }],
      },
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async brandExists(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    return !!brand;
  }

  async categoryExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    return !!category;
  }

  async findBrandById(id: string) {
    return this.prisma.brand.findUnique({ where: { id } });
  }
}
