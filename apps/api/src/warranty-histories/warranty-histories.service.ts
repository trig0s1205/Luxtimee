import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStage,
  OrderStatus,
  Prisma,
  WarrantyHistoryStatus,
} from '@prisma/client';
import { toUpperText, toUpperTextOptional } from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { WarrantyHistoryPeriod } from './dto/warranty-history.dto';
import type {
  CreateWarrantyHistoryDto,
  RegisterWarrantyHistoryDto,
} from './dto/warranty-history.dto';

@Injectable()
export class WarrantyHistoriesService {
  constructor(private prisma: PrismaService) {}

  private mapRecord(record: Prisma.WarrantyHistoryGetPayload<object>) {
    return {
      ...record,
      saleDate: record.saleDate.toISOString(),
      serviceDate: record.serviceDate?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateWarrantyHistoryDto, userId: string) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: {
        order: true,
        watch: { select: { sku: true } },
        warrantyHistory: true,
      },
    });

    if (!item?.order || item.order.stage !== OrderStage.ORDER) {
      throw new NotFoundException('Ítem de pedido no encontrado');
    }
    if (item.order.status !== OrderStatus.ENTREGADO) {
      throw new BadRequestException('Solo se puede registrar garantía en pedidos entregados.');
    }
    if (item.warrantyHistory?.status === WarrantyHistoryStatus.GARANTIA_REGISTRADA) {
      throw new ConflictException('La garantía de este ítem ya fue registrada.');
    }
    if (item.warrantyHistory?.status === WarrantyHistoryStatus.VENTA_ENTREGADA) {
      return this.register(item.warrantyHistory.id, dto, userId);
    }

    const saleDate = item.order.deliveredAt ?? new Date();
    const record = await this.prisma.warrantyHistory.create({
      data: {
        orderId: item.order.id,
        orderItemId: item.id,
        customerName: toUpperText(item.order.customerName),
        customerAddress: toUpperText(item.order.customerAddress),
        customerPhone: toUpperTextOptional(item.order.customerPhone),
        productSku: item.watch.sku,
        productName: toUpperText(item.productName),
        saleDate,
        serviceDate: new Date(),
        damageDescription: toUpperText(dto.damageDescription),
        replacementType: dto.replacementType,
        replacementSku:
          dto.replacementType === 'OTHER_WATCH'
            ? toUpperTextOptional(dto.replacementSku) ?? null
            : item.watch.sku,
        replacementNotes: toUpperTextOptional(dto.replacementNotes) ?? null,
        status: WarrantyHistoryStatus.GARANTIA_REGISTRADA,
        registeredById: userId,
      },
    });

    return this.mapRecord(record);
  }

  async findAll(
    options: {
      period?: WarrantyHistoryPeriod;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const period = options.period ?? 'day';
    const page = options.page ?? 1;
    const limit = options.limit ?? 15;
    const since = this.periodStart(period);
    const search = options.search?.trim();

    const where: Prisma.WarrantyHistoryWhereInput = {
      status: WarrantyHistoryStatus.GARANTIA_REGISTRADA,
      ...(since ? { serviceDate: { gte: since } } : {}),
      ...(search
        ? {
            OR: [
              { productSku: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerPhone: { contains: search, mode: 'insensitive' } },
              { productName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.warrantyHistory.count({ where }),
      this.prisma.warrantyHistory.findMany({
        where,
        orderBy: { serviceDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => this.mapRecord(item)),
      total,
      page,
      limit,
      period,
      periodLabel: this.periodLabel(period),
    };
  }

  async findForExport(period: WarrantyHistoryPeriod) {
    const since = this.periodStart(period);
    const where: Prisma.WarrantyHistoryWhereInput = {
      status: WarrantyHistoryStatus.GARANTIA_REGISTRADA,
      ...(since ? { serviceDate: { gte: since } } : {}),
    };

    const items = await this.prisma.warrantyHistory.findMany({
      where,
      orderBy: { serviceDate: 'desc' },
    });

    return {
      period,
      periodLabel: this.periodLabel(period),
      items: items.map((item) => this.mapRecord(item)),
    };
  }

  async register(id: string, dto: RegisterWarrantyHistoryDto, userId: string) {
    const existing = await this.prisma.warrantyHistory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Historia de garantía no encontrada');

    const updated = await this.prisma.warrantyHistory.update({
      where: { id },
      data: {
        damageDescription: toUpperText(dto.damageDescription),
        replacementType: dto.replacementType,
        replacementSku:
          dto.replacementType === 'OTHER_WATCH'
            ? toUpperTextOptional(dto.replacementSku) ?? null
            : existing.productSku,
        replacementNotes: toUpperTextOptional(dto.replacementNotes) ?? null,
        serviceDate: new Date(),
        status: WarrantyHistoryStatus.GARANTIA_REGISTRADA,
        registeredById: userId,
      },
    });

    return this.mapRecord(updated);
  }

  private periodStart(period: WarrantyHistoryPeriod) {
    const now = new Date();
    if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') return new Date(now.getTime() - 7 * 86400000);
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    return null;
  }

  private periodLabel(period: WarrantyHistoryPeriod) {
    if (period === 'day') return 'Hoy';
    if (period === 'week') return 'Última semana';
    if (period === 'month') return 'Este mes';
    return 'Histórico';
  }
}
