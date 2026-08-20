import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStage, OrderStatus, OrderType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CertificatesService } from '../certificates/certificates.service';
import { assertValidTransition } from './state-machine';
import { UpdateOrderDto } from './dto/update-order.dto';
import type { OrdersPeriod } from './dto/orders-query.dto';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { storefrontHideWhenEmpty } from '../common/utils/storefront-stock.util';

const orderInclude = {
  items: {
    include: {
      watch: { select: { sku: true, frontImageUrl: true } },
      warrantyHistory: { select: { status: true } },
    },
  },
  shippingZone: true,
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private certificatesService: CertificatesService,
    private cache: MemoryCacheService,
  ) {}

  private mapOrder(order: OrderWithRelations) {
    const { items, shippingZone, ...rest } = order;
    return {
      ...rest,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      canceledAt: order.canceledAt?.toISOString() ?? null,
      items: items.map((item) => ({
        id: item.id,
        watchId: item.watchId,
        productSku: item.watch.sku,
        productName: item.productName,
        productRef: item.productRef,
        productImage: item.productImage,
        watchThumbnail: item.watch.frontImageUrl ?? item.productImage ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: item.priceType,
        deliveryNote: item.deliveryNote,
        warrantyRegistered:
          item.warrantyHistory?.status === 'GARANTIA_REGISTRADA',
      })),
      shippingZone: shippingZone
        ? {
            id: shippingZone.id,
            name: shippingZone.name,
            isNational: shippingZone.isNational,
          }
        : null,
    };
  }

  async findAllOrders(options: {
    period?: OrdersPeriod;
    status?: OrderStatus;
    type?: OrderType;
    page?: number;
    limit?: number;
  } = {}) {
    const period = options.period ?? 'day';
    const page = options.page ?? 1;
    const limit = options.limit ?? 15;
    const since = this.periodStart(period);

    const where: Prisma.OrderWhereInput = {
      stage: OrderStage.ORDER,
      ...(since ? this.buildPeriodFilter(since) : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.type ? { type: options.type } : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: orders.map((o) => this.mapOrder(o)),
      total,
      page,
      limit,
      period,
      periodLabel: this.periodLabel(period),
    };
  }

  private buildPeriodFilter(since: Date): Prisma.OrderWhereInput {
    return {
      OR: [
        { createdAt: { gte: since } },
        { updatedAt: { gte: since } },
        { paidAt: { gte: since } },
      ],
    };
  }

  private periodStart(period: OrdersPeriod) {
    const now = new Date();
    if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') return new Date(now.getTime() - 7 * 86400000);
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    return null;
  }

  private periodLabel(period: OrdersPeriod) {
    if (period === 'day') return 'Hoy';
    if (period === 'week') return 'Última semana';
    if (period === 'month') return 'Este mes';
    return 'Histórico';
  }

  async transitionStatus(id: string, next: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order || order.stage !== OrderStage.ORDER || !order.status) {
      throw new NotFoundException('Pedido no encontrado');
    }
    const isNational = order.shippingZone?.isNational ?? false;
    assertValidTransition(order.status, next, isNational);

    const data: Prisma.OrderUpdateInput = { status: next };
    if (next === OrderStatus.PAGADO) {
      data.paidAt = new Date();
      if (!order.depositConfirmed) {
        await this.deductInventory(order.items);
      }
    }
    if (next === OrderStatus.ENVIADO) data.shippedAt = new Date();
    if (next === OrderStatus.ENTREGADO) data.deliveredAt = new Date();
    if (next === OrderStatus.CANCELADO) {
      await this.prisma.order.delete({ where: { id } });
      await this.notificationsService.emit({
        type: 'ORDER_STATUS_CHANGED',
        targetRole: Role.ADMIN,
        payload: { orderId: id, status: next, readableId: order.readableId },
      });
      return { id, deleted: true };
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: orderInclude,
    });

    if (next === OrderStatus.PAGADO) {
      await this.certificatesService.generateForOrder(id);
    }

    await this.notificationsService.emit({
      type: 'ORDER_STATUS_CHANGED',
      targetRole: Role.ADMIN,
      payload: { orderId: id, status: next, readableId: order.readableId },
    });

    return this.mapOrder(updated);
  }

  async findSales(page = 1, limit = 25) {
    const where: Prisma.OrderWhereInput = {
      stage: OrderStage.ORDER,
      status: OrderStatus.ENTREGADO,
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { deliveredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items: orders.map((o) => this.mapOrder(o)), total, page, limit };
  }

  async updateOrder(id: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order || order.stage !== OrderStage.ORDER) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const data: Prisma.OrderUpdateInput = {};

    if (dto.customerAddress !== undefined) {
      data.customerAddress = dto.customerAddress;
    }

    if (dto.shippingCost !== undefined) {
      data.shippingCost = dto.shippingCost;
      data.total = order.subtotal + dto.shippingCost;
    }

    if (dto.status !== undefined) {
      const next = dto.status as OrderStatus;
      if (next !== order.status) {
        if (next === OrderStatus.CANCELADO) {
          const inventoryDeducted =
            order.status !== null &&
            [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO].includes(order.status);
          if (inventoryDeducted) {
            await this.restoreInventory(order.items);
          }
          data.canceledAt = new Date();
        } else if (next === OrderStatus.PAGADO && order.status !== OrderStatus.PAGADO) {
          data.paidAt = new Date();
          await this.deductInventory(order.items);
        } else if (next === OrderStatus.ENVIADO) {
          data.shippedAt = new Date();
        } else if (next === OrderStatus.ENTREGADO) {
          data.deliveredAt = new Date();
        }
        data.status = next;
      }
    }

    const updated = await this.prisma.order.update({ where: { id }, data, include: orderInclude });

    await this.notificationsService.emit({
      type: 'ORDER_STATUS_CHANGED',
      targetRole: Role.ADMIN,
      payload: { orderId: id, status: updated.status ?? '', readableId: updated.readableId },
    });

    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return this.mapOrder(updated);
  }

  async deleteOrder(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order || order.stage !== OrderStage.ORDER) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (order.status === OrderStatus.CANCELADO) {
      await this.prisma.order.delete({ where: { id } });
      return { id, deleted: true };
    }
    const inventoryDeducted =
      order.status !== null &&
      [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO].includes(order.status);
    if (inventoryDeducted) {
      await this.restoreInventory(order.items);
    }
    await this.prisma.order.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async restoreInventory(items: { watchId: string; quantity: number }[]) {
    for (const item of items) {
      await this.prisma.watch.update({
        where: { id: item.watchId },
        data: {
          stock: { increment: item.quantity },
          status: 'DISPONIBLE',
        },
      });
    }
    this.cache.invalidateTag(CACHE_TAGS.catalog);
  }

  private async deductInventory(items: { watchId: string; quantity: number }[]) {
    for (const item of items) {
      await this.prisma.watch.update({
        where: { id: item.watchId },
        data: { stock: { decrement: item.quantity } },
      });

      const watch = await this.prisma.watch.findUnique({
        where: { id: item.watchId },
        select: { stock: true },
      });

      if (watch && watch.stock <= 0) {
        await this.prisma.watch.update({
          where: { id: item.watchId },
          data: storefrontHideWhenEmpty(0),
        });
      }
    }

    this.cache.invalidateTag(CACHE_TAGS.catalog);
  }
}
