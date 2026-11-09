import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WarrantyClaimStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { warrantyStatus } from '../receipts/warranty.util';
import { normalizeReceiptNumberQuery } from '../receipts/receipt-search.util';
import {
  assertClaimTransition,
  getClaimAllowedTransitions,
} from './claim-state';
import type {
  CreateWarrantyClaimDto,
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

@Injectable()
export class WarrantyClaimsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const existing = await this.prisma.warrantyClaim.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Reclamo no encontrado');

    assertClaimTransition(existing.status, dto.status);

    // REEMPLAZADO no descuenta stock automáticamente en esta versión;
    // documentar el reemplazo en notes/note del evento.
    const now = new Date();
    const data: Prisma.WarrantyClaimUpdateInput = {
      status: dto.status,
    };
    if (
      dto.status === WarrantyClaimStatus.REPARADO ||
      dto.status === WarrantyClaimStatus.REEMPLAZADO ||
      dto.status === WarrantyClaimStatus.RECHAZADO
    ) {
      data.resolvedAt = now;
    }
    if (dto.status === WarrantyClaimStatus.ENTREGADO) {
      data.deliveredAt = now;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
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
    });

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
    return {
      id: row.id,
      status: row.status,
      reportedIssue: row.reportedIssue,
      notes: row.notes,
      outOfWarranty: row.outOfWarranty,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
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
      // El reemplazo de reloj no descuenta stock automáticamente.
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
