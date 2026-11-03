import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStage, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  InventoryInsightWatchDto,
  InventoryInsightsDto,
} from '@luxtime/shared';
import { findWatchIdsByTextSearch } from '../common/utils/watch-text-search.util';
import {
  formatWatchSku,
  recomputeSkuKeepingSequence,
  resolveSkuPrefix,
} from './utils/sku.util';
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
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(200, query.limit ?? 20));
    const search = query.search?.trim();
    const sellable = query.availability === 'sellable';

    if (search || sellable) {
      const { ids, total } = await findWatchIdsByTextSearch(this.prisma, {
        search,
        brand: query.brand,
        status: query.status,
        sellable,
        skip: (page - 1) * limit,
        take: limit,
      });
      if (!ids.length) return { data: [], total, page, limit };
      const rows = await this.prisma.watch.findMany({
        where: { id: { in: ids } },
        include: watchInclude,
      });
      const order = new Map(ids.map((id, index) => [id, index]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return { data: rows, total, page, limit };
    }

    const where: Prisma.WatchWhereInput = { deletedAt: null };

    if (query.brand) {
      where.brand = { slug: { equals: query.brand, mode: 'insensitive' } };
    }

    if (query.status) {
      where.status = query.status;
    }

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

  async allocateReplacementSku(input: {
    watchId: string;
    currentSku: string;
    retailPrice: number;
    gender?: string | null;
  }) {
    const desired = recomputeSkuKeepingSequence(
      input.currentSku,
      input.retailPrice,
      input.gender,
    );
    if (!desired || desired.toUpperCase() === input.currentSku.trim().toUpperCase()) {
      return input.currentSku;
    }

    return this.prisma.$transaction(async (tx) => {
      const prefix = resolveSkuPrefix(input.retailPrice, input.gender);
      await this.lockKey(tx, 'luxtime-sku', prefix);
      const taken = await tx.watch.findFirst({
        where: { sku: desired, NOT: { id: input.watchId } },
        select: { id: true },
      });
      const sku = taken
        ? await this.allocateSkuLocked(tx, input.retailPrice, input.gender)
        : desired;
      await tx.watch.update({ where: { id: input.watchId }, data: { sku } });
      return sku;
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
    const active = { isActive: true, deletedAt: null };
    const now = Date.now();
    const soldWhere = {
      watch: active,
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
    };

    const [totals, outOfStockCount, lowest, highest, oldest, salesAgg] =
      await Promise.all([
        this.prisma.watch.aggregate({
          where: active,
          _sum: { stock: true },
          _count: { _all: true },
        }),
        this.prisma.watch.count({ where: { ...active, stock: 0 } }),
        this.prisma.watch.findFirst({
          where: active,
          orderBy: [{ stock: 'asc' }, { id: 'asc' }],
          select: insightWatchSelect,
        }),
        this.prisma.watch.findFirst({
          where: active,
          orderBy: [{ stock: 'desc' }, { id: 'asc' }],
          select: insightWatchSelect,
        }),
        this.prisma.watch.findFirst({
          where: { ...active, stock: { gt: 0 } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: insightWatchSelect,
        }),
        this.prisma.orderItem.groupBy({
          by: ['watchId'],
          _sum: { quantity: true },
          where: soldWhere,
        }),
      ]);

    const unitsByWatch = new Map(
      salesAgg.map((row) => [row.watchId, row._sum.quantity ?? 0]),
    );
    const soldIds = [...unitsByWatch.keys()];
    let mostId: string | null = null;
    let mostUnits = -1;
    let leastSoldId: string | null = null;
    let leastUnits = Number.POSITIVE_INFINITY;
    for (const [id, units] of unitsByWatch) {
      if (units > mostUnits) {
        mostUnits = units;
        mostId = id;
      }
      if (units < leastUnits) {
        leastUnits = units;
        leastSoldId = id;
      }
    }

    const unsold = await this.prisma.watch.findFirst({
      where: {
        ...active,
        ...(soldIds.length ? { id: { notIn: soldIds } } : {}),
      },
      orderBy: [{ id: 'asc' }],
      select: insightWatchSelect,
    });
    const [least, most] = await Promise.all([
      unsold
        ? Promise.resolve(unsold)
        : leastSoldId
          ? this.prisma.watch.findFirst({
              where: { id: leastSoldId, ...active },
              select: insightWatchSelect,
            })
          : Promise.resolve(null),
      mostId
        ? this.prisma.watch.findFirst({
            where: { id: mostId, ...active },
            select: insightWatchSelect,
          })
        : Promise.resolve(unsold),
    ]);

    const picked = [lowest, highest, oldest, least, most].filter(
      (row): row is InsightWatchRow => !!row,
    );
    const brandIds = [...new Set(picked.map((row) => row.brandId))];
    const brands = brandIds.length
      ? await this.prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true },
        })
      : [];
    const brandNames = new Map(brands.map((brand) => [brand.id, brand.name]));

    const toInsight = (
      watch: InsightWatchRow | null,
    ): InventoryInsightWatchDto | null => {
      if (!watch) return null;
      const created = new Date(watch.createdAt);
      const createdMs = created.getTime();
      return {
        id: watch.id,
        model: watch.model,
        brand: brandNames.get(watch.brandId) ?? '',
        reference: watch.reference,
        image: insightImage(watch),
        stock: watch.stock,
        unitsSold: unitsByWatch.get(watch.id) ?? 0,
        createdAt: Number.isNaN(createdMs)
          ? new Date(0).toISOString()
          : created.toISOString(),
        daysInInventory: Number.isNaN(createdMs)
          ? 0
          : Math.max(0, Math.floor((now - createdMs) / 86400000)),
      };
    };

    return {
      totalUnits: totals._sum.stock ?? 0,
      totalSkus: countAll(totals._count),
      outOfStockCount,
      lowestStock: toInsight(lowest),
      highestStock: toInsight(highest),
      oldestInStock: toInsight(oldest),
      leastSold: toInsight(least),
      mostSold: toInsight(most),
    };
  }
}

const insightWatchSelect = {
  id: true,
  model: true,
  reference: true,
  stock: true,
  createdAt: true,
  frontImageUrl: true,
  primaryImageUrl: true,
  images: true,
  brandId: true,
} as const;

type InsightWatchRow = {
  id: string;
  model: string;
  reference: string | null;
  stock: number;
  createdAt: Date;
  frontImageUrl: string | null;
  primaryImageUrl: string | null;
  images: string[] | null;
  brandId: string;
};

function insightImage(
  watch: Pick<InsightWatchRow, 'frontImageUrl' | 'primaryImageUrl' | 'images'>,
) {
  const images = Array.isArray(watch.images) ? watch.images : [];
  return watch.frontImageUrl ?? watch.primaryImageUrl ?? images[0] ?? null;
}

function countAll(count: number | { _all?: number } | null | undefined) {
  if (typeof count === 'number') return count;
  return count?._all ?? 0;
}
