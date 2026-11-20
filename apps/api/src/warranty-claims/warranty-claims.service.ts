import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WarrantyClaimStatus,
} from '@prisma/client';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { warrantyStatus } from '../receipts/warranty.util';
import { normalizeReceiptNumberQuery } from '../receipts/receipt-search.util';
import {
  reserveWatchStock,
  STOCK_TRANSACTION,
} from '../common/utils/watch-stock.tx';
import {
  assertClaimTransition,
  getClaimAllowedTransitions,
} from './claim-state';
import type {
  CreateWarrantyClaimDto,
  ReplacementWatchesQueryDto,
  UpdateWarrantyClaimNotesDto,
  UpdateWarrantyClaimStatusDto,
  WarrantyClaimsQueryDto,
} from './dto/warranty-claim.dto';

const claimListInclude = {
  receiptItem: {
    include: {
      receipt: {
        select: {
          id: true,
          number: true,
          customerName: true,
          customerPhone: true,
          customerDocument: true,
          saleDate: true,
          voidedAt: true,
        },
      },
    },
  },
  events: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: { createdBy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.WarrantyClaimInclude;

const replacementWatchSelect = {
  id: true,
  sku: true,
  model: true,
  stock: true,
  retailPrice: true,
  brand: { select: { name: true } },
} satisfies Prisma.WatchSelect;

const claimDetailInclude = {
  receiptItem: {
    include: {
      receipt: {
        select: {
          id: true,
          number: true,
          customerName: true,
          customerPhone: true,
          customerDocument: true,
          saleDate: true,
          voidedAt: true,
        },
      },
    },
  },
  replacementWatch: { select: replacementWatchSelect },
  events: {
    orderBy: { createdAt: 'asc' as const },
    include: { createdBy: { select: { id: true, name: true } } },
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.WarrantyClaimInclude;

type ClaimListRow = Prisma.WarrantyClaimGetPayload<{
  include: typeof claimListInclude;
}>;
type ClaimDetailRow = Prisma.WarrantyClaimGetPayload<{
  include: typeof claimDetailInclude;
}>;
type ReplacementWatchRow = Prisma.WatchGetPayload<{
  select: typeof replacementWatchSelect;
}>;

function toReplacementWatchOption(row: ReplacementWatchRow) {
  return {
    id: row.id,
    sku: row.sku,
    brand: row.brand.name,
    model: row.model,
    stock: row.stock,
    price: row.retailPrice,
  };
}

function replacementEventNote(sku: string, note?: string) {
  const skuNote = `Reemplazo SKU: ${sku}`;
  const extra = note?.trim();
  return extra ? `${skuNote}. ${extra}` : skuNote;
}

@Injectable()
export class WarrantyClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MemoryCacheService,
  ) {}

  async create(dto: CreateWarrantyClaimDto, userId: string) {
    const item = await this.prisma.saleReceiptItem.findUnique({
      where: { id: dto.receiptItemId },
      include: {
        receipt: { select: { id: true, voidedAt: true } },
      },
    });
    if (!item) {
      throw new NotFoundException('Ítem de comprobante no encontrado');
    }
    if (item.receipt.voidedAt) {
      throw new BadRequestException(
        'No se puede abrir un reclamo sobre un comprobante anulado',
      );
    }

    const status = warrantyStatus(item.warrantyEndsAt);
    const outOfWarranty =
      status.state === 'VENCIDA' || status.state === 'SIN_GARANTIA';

    const claim = await this.prisma.$transaction(async (tx) => {
      const created = await tx.warrantyClaim.create({
        data: {
          receiptItemId: item.id,
          status: WarrantyClaimStatus.RECIBIDO,
          reportedIssue: dto.reportedIssue,
          notes: dto.notes?.trim() ? dto.notes.trim() : null,
          outOfWarranty,
          createdById: userId,
          events: {
            create: {
              fromStatus: null,
              toStatus: WarrantyClaimStatus.RECIBIDO,
              createdById: userId,
            },
          },
        },
        include: claimDetailInclude,
      });
      return created;
    });

    return this.mapDetail(claim);
  }

  async updateStatus(
    id: string,
    dto: UpdateWarrantyClaimStatusDto,
    userId: string,
  ) {
    const replacementSku = dto.replacementSku?.trim();
    if (dto.status === WarrantyClaimStatus.REEMPLAZADO && !replacementSku) {
      throw new BadRequestException('Indica el SKU del reloj de reemplazo');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.warrantyClaim.findUnique({
        where: { id },
        select: { id: true, status: true, replacementWatchId: true },
      });
      if (!existing) throw new NotFoundException('Reclamo no encontrado');

      assertClaimTransition(existing.status, dto.status);

      if (dto.status === WarrantyClaimStatus.REEMPLAZADO) {
        return this.applyReplacement(tx, {
          id,
          fromStatus: existing.status,
          replacementWatchId: existing.replacementWatchId,
          sku: replacementSku!,
          note: dto.note,
          userId,
        });
      }

      const now = new Date();
      const data: Prisma.WarrantyClaimUpdateInput = {
        status: dto.status,
      };
      if (
        dto.status === WarrantyClaimStatus.REPARADO ||
        dto.status === WarrantyClaimStatus.RECHAZADO
      ) {
        data.resolvedAt = now;
      }
      if (dto.status === WarrantyClaimStatus.ENTREGADO) {
        data.deliveredAt = now;
      }

      await tx.warrantyClaimEvent.create({
        data: {
          claimId: id,
          fromStatus: existing.status,
          toStatus: dto.status,
          note: dto.note?.trim() ? dto.note.trim() : null,
          createdById: userId,
        },
      });
      return tx.warrantyClaim.update({
        where: { id },
        data,
        include: claimDetailInclude,
      });
    }, STOCK_TRANSACTION);

    if (dto.status === WarrantyClaimStatus.REEMPLAZADO) {
      this.cache.invalidateTag(CACHE_TAGS.catalog);
    }

    return this.mapDetail(updated);
  }

  async updateNotes(id: string, dto: UpdateWarrantyClaimNotesDto) {
    const existing = await this.prisma.warrantyClaim.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Reclamo no encontrado');

    const updated = await this.prisma.warrantyClaim.update({
      where: { id },
      data: { notes: dto.notes },
      include: claimDetailInclude,
    });
    return this.mapDetail(updated);
  }

  async listReplacementWatches(query: ReplacementWatchesQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(100, query.limit ?? 20);
    const brand = query.brand?.trim();
    const search = query.search?.trim();
    const sku = query.sku?.trim();
    const where: Prisma.WatchWhereInput = {
      deletedAt: null,
      isActive: true,
      stock: { gt: 0 },
    };
    if (brand) {
      where.brand = { slug: { equals: brand, mode: 'insensitive' } };
    }
    if (sku) {
      where.sku = { equals: sku, mode: 'insensitive' };
    }
    if (search && search.length >= 2) {
      where.AND = [
        {
          OR: [
            { sku: { contains: search, mode: 'insensitive' } },
            { model: { contains: search, mode: 'insensitive' } },
            { brand: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const shouldList = Boolean(brand || sku || (search && search.length >= 2));
    const [brands, total, rows] = await Promise.all([
      this.prisma.brand.findMany({
        where: {
          watches: {
            some: { deletedAt: null, isActive: true, stock: { gt: 0 } },
          },
        },
        select: { slug: true, name: true },
        orderBy: { name: 'asc' },
      }),
      shouldList
        ? this.prisma.watch.count({ where })
        : Promise.resolve(0),
      shouldList
        ? this.prisma.watch.findMany({
            where,
            select: replacementWatchSelect,
            orderBy: [{ brand: { name: 'asc' } }, { model: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
          })
        : Promise.resolve([]),
    ]);

    return {
      brands,
      data: rows.map(toReplacementWatchOption),
      total,
      page,
      limit,
    };
  }

  async findAll(query: WarrantyClaimsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(100, query.limit ?? 20);
    const where = this.buildListWhere(query);

    const [total, rows] = await Promise.all([
      this.prisma.warrantyClaim.count({ where }),
      this.prisma.warrantyClaim.findMany({
        where,
        include: claimListInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.mapList(row)),
      total,
      page,
      limit,
    };
  }

  async findById(id: string) {
    const claim = await this.prisma.warrantyClaim.findUnique({
      where: { id },
      include: claimDetailInclude,
    });
    if (!claim) throw new NotFoundException('Reclamo no encontrado');
    return this.mapDetail(claim);
  }

  private async applyReplacement(
    tx: Prisma.TransactionClient,
    input: {
      id: string;
      fromStatus: WarrantyClaimStatus;
      replacementWatchId: string | null;
      sku: string;
      note?: string;
      userId: string;
    },
  ) {
    if (input.replacementWatchId) {
      throw new BadRequestException(
        'Este reclamo ya descontó un reloj de reemplazo',
      );
    }

    const watch = await tx.watch.findFirst({
      where: {
        sku: { equals: input.sku, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true, sku: true },
    });
    if (!watch) {
      throw new BadRequestException('Reloj de reemplazo no encontrado');
    }

    await reserveWatchStock(
      tx,
      [{ watchId: watch.id, quantity: 1 }],
      { requireActive: true },
    );

    const claimed = await tx.warrantyClaim.updateMany({
      where: { id: input.id, replacementWatchId: null },
      data: {
        status: WarrantyClaimStatus.REEMPLAZADO,
        resolvedAt: new Date(),
        replacementWatchId: watch.id,
        replacementSku: watch.sku,
      },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException(
        'Este reclamo ya descontó un reloj de reemplazo',
      );
    }

    await tx.warrantyClaimEvent.create({
      data: {
        claimId: input.id,
        fromStatus: input.fromStatus,
        toStatus: WarrantyClaimStatus.REEMPLAZADO,
        note: replacementEventNote(watch.sku, input.note),
        createdById: input.userId,
      },
    });

    return tx.warrantyClaim.findUniqueOrThrow({
      where: { id: input.id },
      include: claimDetailInclude,
    });
  }

  private buildListWhere(
    query: WarrantyClaimsQueryDto,
  ): Prisma.WarrantyClaimWhereInput {
    const where: Prisma.WarrantyClaimWhereInput = {};
    if (query.status) where.status = query.status;

    const q = query.q?.trim();
    if (!q) return where;

    const receiptNumber = normalizeReceiptNumberQuery(q);
    const phoneDigits = q.replace(/\D/g, '');
    const receiptOr: Prisma.SaleReceiptWhereInput[] = [
      { number: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerDocument: { contains: q, mode: 'insensitive' } },
      { orderReadableId: { contains: q, mode: 'insensitive' } },
    ];
    if (receiptNumber) receiptOr.push({ number: receiptNumber });
    if (phoneDigits) receiptOr.push({ customerPhone: { contains: phoneDigits } });

    where.OR = [
      { reportedIssue: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
      {
        receiptItem: {
          OR: [
            { productName: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { receipt: { OR: receiptOr } },
          ],
        },
      },
    ];
    return where;
  }

  private mapReplacementWatch(
    watch: ClaimDetailRow['replacementWatch'],
  ) {
    if (!watch) return null;
    return toReplacementWatchOption(watch);
  }

  private mapList(row: ClaimListRow) {
    const last = row.events[0] ?? null;
    return {
      id: row.id,
      status: row.status,
      reportedIssue: row.reportedIssue,
      notes: row.notes,
      outOfWarranty: row.outOfWarranty,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      replacementSku: row.replacementSku ?? null,
      productName: row.receiptItem.productName,
      sku: row.receiptItem.sku,
      limitedEditionNumber: row.receiptItem.limitedEditionNumber,
      receiptId: row.receiptItem.receipt.id,
      receiptNumber: row.receiptItem.receipt.number,
      customerName: row.receiptItem.receipt.customerName,
      customerPhone: row.receiptItem.receipt.customerPhone,
      customerDocument: row.receiptItem.receipt.customerDocument,
      lastEvent: last
        ? {
            fromStatus: last.fromStatus,
            toStatus: last.toStatus,
            note: last.note,
            createdAt: last.createdAt.toISOString(),
            createdByName: last.createdBy.name,
          }
        : null,
    };
  }

  private mapDetail(row: ClaimDetailRow) {
    const replacementWatch = this.mapReplacementWatch(row.replacementWatch);
    return {
      id: row.id,
      status: row.status,
      reportedIssue: row.reportedIssue,
      notes: row.notes,
      outOfWarranty: row.outOfWarranty,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      replacementSku: row.replacementSku ?? replacementWatch?.sku ?? null,
      replacementWatch,
      allowedTransitions: getClaimAllowedTransitions(row.status),
      createdByName: row.createdBy.name,
      productName: row.receiptItem.productName,
      sku: row.receiptItem.sku,
      limitedEditionNumber: row.receiptItem.limitedEditionNumber,
      brandName: row.receiptItem.brandName,
      model: row.receiptItem.model,
      receiptId: row.receiptItem.receipt.id,
      receiptNumber: row.receiptItem.receipt.number,
      customerName: row.receiptItem.receipt.customerName,
      customerPhone: row.receiptItem.receipt.customerPhone,
      customerDocument: row.receiptItem.receipt.customerDocument,
      saleDate: row.receiptItem.receipt.saleDate.toISOString(),
      events: row.events.map((ev) => ({
        id: ev.id,
        fromStatus: ev.fromStatus,
        toStatus: ev.toStatus,
        note: ev.note,
        createdAt: ev.createdAt.toISOString(),
        createdByName: ev.createdBy.name,
      })),
    };
  }
}
