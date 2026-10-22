import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStage, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  InventoryInsightWatchDto,
  InventoryInsightsDto,
} from '@luxtime/shared';
import { findWatchIdsByFlexibleSkuSearch } from '../common/utils/sku-search.util';
import { formatWatchSku, resolveSkuPrefix } from './utils/sku.util';
import { BULK_DRAFT_IDEMPOTENCY_FIELD } from './utils/bulk-draft.util';
import { WatchQueryDto } from './dto/watch-query.dto';

const watchInclude = {
  brand: true,
  category: true,
  mechanism: true,
  warrantyTemplate: true,
  careTemplate: true,
} as const;

function isSkuUniqueConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const target = error.meta?.target;
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  if (!text || text === 'undefined') return true;
  return text.toLowerCase().includes('sku');
}

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
      const skuIds = await findWatchIdsByFlexibleSkuSearch(this.prisma, term);
      where.OR = [
        { model: { contains: term, mode: 'insensitive' } },
        { reference: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { brand: { name: { contains: term, mode: 'insensitive' } } },
        ...(skuIds.length ? [{ id: { in: skuIds } }] : []),
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
      data: {
        deletedAt: new Date(),
        isActive: false,
        isPublished: false,
      },
      include: watchInclude,
    });
  }

  async softDeleteMany(ids: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.watch.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });
      const deletedIds = existing.map((row) => row.id);
      if (deletedIds.length) {
        await tx.watch.updateMany({
          where: { id: { in: deletedIds }, deletedAt: null },
          data: {
            deletedAt: new Date(),
            isActive: false,
            isPublished: false,
          },
        });
      }
      const found = new Set(deletedIds);
      return {
        deletedIds,
        missingIds: ids.filter((id) => !found.has(id)),
      };
    });
  }

  async allocateSku(
    retailPrice: number,
    gender?: string | null,
  ): Promise<string> {
    return this.prisma.$transaction((tx) =>
      this.allocateSkuLocked(tx, retailPrice, gender),
    );
  }

  async createAllocatingSku(
    data: Prisma.WatchCreateInput,
    retailPrice: number,
    gender?: string | null,
  ) {
    const { sku: _ignored, ...rest } = data;
    return this.insertWithSkuRetry(rest, retailPrice, gender);
  }

  async findByBulkDraftKey(key: string) {
    return this.prisma.watch.findFirst({
      where: {
        deletedAt: null,
        specs: {
          path: [BULK_DRAFT_IDEMPOTENCY_FIELD],
          equals: key,
        },
      },
      include: watchInclude,
    });
  }

  async createBulkDraftOnce(input: {
    idempotencyKey: string;
    retailPrice: number;
    gender?: string | null;
    data: Prisma.WatchCreateInput;
  }) {
    const { sku: _ignored, ...rest } = input.data;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.lockKey(tx, 'luxtime-bulk-draft', input.idempotencyKey);
          const existing = await tx.watch.findFirst({
            where: {
              deletedAt: null,
              specs: {
                path: [BULK_DRAFT_IDEMPOTENCY_FIELD],
                equals: input.idempotencyKey,
              },
            },
            include: watchInclude,
          });
          if (existing) return { watch: existing, created: false as const };
          const sku = await this.allocateSkuLocked(
            tx,
            input.retailPrice,
            input.gender,
          );
          const watch = await tx.watch.create({
            data: { ...rest, sku },
            include: watchInclude,
          });
          return { watch, created: true as const };
        });
      } catch (error) {
        if (isSkuUniqueConflict(error) && attempt < 4) continue;
        throw error;
      }
    }
    throw new BadRequestException('No se pudo asignar un SKU único');
  }

  private async insertWithSkuRetry(
    data: Omit<Prisma.WatchCreateInput, 'sku'>,
    retailPrice: number,
    gender?: string | null,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const sku = await this.allocateSkuLocked(tx, retailPrice, gender);
          return tx.watch.create({
            data: { ...data, sku },
            include: watchInclude,
          });
        });
      } catch (error) {
        if (isSkuUniqueConflict(error) && attempt < 4) continue;
        throw error;
      }
    }
    throw new BadRequestException('No se pudo asignar un SKU único');
  }

  private async allocateSkuLocked(
    tx: Prisma.TransactionClient,
    retailPrice: number,
    gender?: string | null,
  ) {
    const prefix = resolveSkuPrefix(retailPrice, gender);
    await this.lockKey(tx, 'luxtime-sku', prefix);
    const rows = await tx.watch.findMany({
      where: { sku: { startsWith: `${prefix}-` } },
      select: { sku: true },
    });
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    let max = 0;
    for (const row of rows) {
      const match = row.sku.match(pattern);
      if (!match) continue;
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value > max) max = value;
    }
    return formatWatchSku(prefix, max + 1);
  }

  private lockKey(tx: Prisma.TransactionClient, namespace: string, key: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${namespace}), hashtext(${key}))`;
  }

  async findAllForPendingReview() {
    return this.prisma.watch.findMany({
      where: { deletedAt: null },
      include: watchInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findPendingCost(page = 1, limit = 10) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const where = {
      deletedAt: null,
      OR: [{ cost: null }, { cost: 0 }],
    };
    const [total, data] = await Promise.all([
      this.prisma.watch.count({ where }),
      this.prisma.watch.findMany({
        where,
        include: { brand: true },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);
    return { data, total, page: safePage, limit: safeLimit };
  }

  async brandExists(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    return !!brand;
  }

  async findFirstBrandId() {
    const brand = await this.prisma.brand.findFirst({
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    return brand?.id ?? null;
  }

  async categoryExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    return !!category;
  }

  async findBrandById(id: string) {
    return this.prisma.brand.findUnique({ where: { id } });
  }

  async getInventoryInsights(): Promise<InventoryInsightsDto> {
    const watchWhere = { isActive: true, deletedAt: null };
    const now = Date.now();

    const [watches, salesAgg, stockSum, outOfStock] = await Promise.all([
      this.prisma.watch.findMany({
        where: watchWhere,
        include: { brand: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['watchId'],
        _sum: { quantity: true },
        where: {
          order: {
            stage: OrderStage.ORDER,
            status: {
              in: [
                OrderStatus.PAGADO,
                OrderStatus.ENVIADO,
                OrderStatus.ENTREGADO,
              ],
            },
            canceledAt: null,
          },
        },
      }),
      this.prisma.watch.aggregate({
        where: watchWhere,
        _sum: { stock: true },
        _count: true,
      }),
      this.prisma.watch.count({ where: { ...watchWhere, stock: 0 } }),
    ]);

    const salesMap = new Map(
      salesAgg.map((row) => [row.watchId, row._sum.quantity ?? 0]),
    );

    const toInsight = (
      watch: (typeof watches)[number],
    ): InventoryInsightWatchDto => ({
      id: watch.id,
      model: watch.model,
      brand: watch.brand.name,
      reference: watch.reference,
      image:
        watch.frontImageUrl ?? watch.primaryImageUrl ?? watch.images[0] ?? null,
      stock: watch.stock,
      unitsSold: salesMap.get(watch.id) ?? 0,
      createdAt: watch.createdAt.toISOString(),
      daysInInventory: Math.max(
        0,
        Math.floor((now - watch.createdAt.getTime()) / 86400000),
      ),
    });

    const pickExtreme = <T>(
      items: T[],
      compare: (a: T, b: T) => boolean,
    ): T | null => {
      if (!items.length) return null;
      return items.reduce((best, current) =>
        compare(current, best) ? current : best,
      );
    };

    const withStock = watches.filter((watch) => watch.stock > 0);

    const lowest = pickExtreme(watches, (a, b) => a.stock <= b.stock);
    const highest = pickExtreme(watches, (a, b) => a.stock >= b.stock);
    const oldest = pickExtreme(withStock, (a, b) => a.createdAt <= b.createdAt);
    const least = pickExtreme(
      watches,
      (a, b) => (salesMap.get(a.id) ?? 0) <= (salesMap.get(b.id) ?? 0),
    );
    const most = pickExtreme(
      watches,
      (a, b) => (salesMap.get(a.id) ?? 0) >= (salesMap.get(b.id) ?? 0),
    );

    return {
      totalUnits: stockSum._sum.stock ?? 0,
      totalSkus: stockSum._count,
      outOfStockCount: outOfStock,
      lowestStock: lowest ? toInsight(lowest) : null,
      highestStock: highest ? toInsight(highest) : null,
      oldestInStock: oldest ? toInsight(oldest) : null,
      leastSold: least ? toInsight(least) : null,
      mostSold: most ? toInsight(most) : null,
    };
  }
}
