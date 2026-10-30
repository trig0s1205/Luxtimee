import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStage,
  OrderStatus,
  OrderType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CertificatesService } from '../certificates/certificates.service';
import { assertValidTransition } from './state-machine';
import { UpdateOrderDto } from './dto/update-order.dto';
import type { OrdersPeriod } from './dto/orders-query.dto';
import { buildOrderSearchWhere } from './order-search.util';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import {
  reserveWatchStock,
  restoreWatchStock,
  STOCK_TRANSACTION,
} from '../common/utils/watch-stock.tx';
import { CustomerNotifier } from '../integrations/customer-notifier.service';
import {
  buildCustomerWhatsappUrl,
  customerStatusWhatsappMessage,
} from '../integrations/customer-whatsapp';

const orderInclude = {
  items: {
    include: {
      watch: { select: { sku: true, frontImageUrl: true } },
      warrantyHistory: { select: { status: true } },
    },
  },
  shippingZone: true,
} as const;

const inventoryDeductedStatuses: OrderStatus[] = [
  OrderStatus.PAGADO,
  OrderStatus.ENVIADO,
  OrderStatus.ENTREGADO,
];

export function isInventoryDeducted(order: {
  status: OrderStatus | null;
  depositConfirmed: boolean;
}): boolean {
  if (!order.status || order.status === OrderStatus.CANCELADO) return false;
  if (order.depositConfirmed) return true;
  return inventoryDeductedStatuses.includes(order.status);
}

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private certificatesService: CertificatesService,
    private cache: MemoryCacheService,
    private customerNotifier: CustomerNotifier,
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
        productSku: item.productSku?.trim() || item.watch.sku,
        productName: item.productName,
        productRef: item.productRef,
        productImage: item.productImage,
        watchThumbnail: item.watch.frontImageUrl ?? item.productImage ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: item.priceType,
        deliveryNote: item.deliveryNote,
        extrasSnapshot: item.extrasSnapshot,
        packageName: item.packageName,
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
      customerWhatsappUrl: buildCustomerWhatsappUrl(
        order.customerPhone,
        customerStatusWhatsappMessage(order),
      ),
    };
  }

  private async notifyCustomer(
    order: {
      readableId: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string | null;
      wholesaleAccessId: string | null;
    },
    event: 'canceled' | 'shipped',
  ) {
    try {
      await this.customerNotifier.notifyOrder({
        event,
        readableId: order.readableId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        wholesaleAccessId: order.wholesaleAccessId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Aviso de ${order.readableId} no enviado: ${message}`);
    }
  }

  async findAllOrders(
    options: {
      period?: OrdersPeriod;
      status?: OrderStatus;
      type?: OrderType;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const period = options.period ?? 'day';
    const page = options.page ?? 1;
    const limit = options.limit ?? 15;
    const since = this.periodStart(period);
    const filters: Prisma.OrderWhereInput[] = [];
    if (since) filters.push(this.buildPeriodFilter(since));
    if (options.status) filters.push({ status: options.status });
    if (options.type) filters.push({ type: options.type });
    const searchWhere = buildOrderSearchWhere(options.search);
    if (searchWhere) filters.push(searchWhere);

    const where: Prisma.OrderWhereInput = {
      stage: OrderStage.ORDER,
      ...(filters.length ? { AND: filters } : {}),
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
    if (period === 'day')
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') return new Date(now.getTime() - 7 * 86400000);
    if (period === 'month')
      return new Date(now.getFullYear(), now.getMonth(), 1);
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

    if (next === OrderStatus.CANCELADO) {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id,
            status: order.status,
            depositConfirmed: order.depositConfirmed,
          },
          data: { status: OrderStatus.CANCELADO, canceledAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('El pedido ya cambió de estado');
        }
        if (isInventoryDeducted(order)) {
          await this.restoreInventory(order.items, tx);
        }
        await tx.order.delete({ where: { id } });
      }, STOCK_TRANSACTION);
      this.cache.invalidateTag(CACHE_TAGS.catalog);
      await this.notificationsService.emit({
        type: 'ORDER_STATUS_CHANGED',
        targetRole: Role.ADMIN,
        payload: { orderId: id, status: next, readableId: order.readableId },
      });
      await this.notifyCustomer(order, 'canceled');
      return { id, deleted: true };
    }

    const data: Prisma.OrderUpdateManyMutationInput = { status: next };
    if (next === OrderStatus.PAGADO) data.paidAt = new Date();
    if (next === OrderStatus.ENVIADO) data.shippedAt = new Date();
    if (next === OrderStatus.ENTREGADO) data.deliveredAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id,
          status: order.status,
          depositConfirmed: order.depositConfirmed,
        },
        data,
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('El pedido ya cambió de estado');
      }
      if (next === OrderStatus.PAGADO && !order.depositConfirmed) {
        await this.deductInventory(order.items, tx);
      }
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    }, STOCK_TRANSACTION);

    if (next === OrderStatus.PAGADO) {
      await this.certificatesService.generateForOrder(id);
    }
    if (next === OrderStatus.ENVIADO) {
      await this.notifyCustomer(order, 'shipped');
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
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order || order.stage !== OrderStage.ORDER) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const data: Prisma.OrderUpdateManyMutationInput = {};

    if (dto.customerAddress !== undefined) {
      data.customerAddress = dto.customerAddress;
    }

    if (dto.shippingCost !== undefined) {
      data.shippingCost = dto.shippingCost;
      data.total = order.subtotal + dto.shippingCost;
    }

    let next: OrderStatus | undefined;
    if (dto.status !== undefined && dto.status !== order.status) {
      next = dto.status;
      if (next === OrderStatus.CANCELADO) {
        data.canceledAt = new Date();
      } else if (
        next === OrderStatus.PAGADO &&
        order.status !== OrderStatus.PAGADO
      ) {
        data.paidAt = new Date();
      } else if (next === OrderStatus.ENVIADO) {
        data.shippedAt = new Date();
      } else if (next === OrderStatus.ENTREGADO) {
        data.deliveredAt = new Date();
      }
      data.status = next;
    }

    const shouldRestore =
      next === OrderStatus.CANCELADO && isInventoryDeducted(order);
    const shouldDeduct =
      next === OrderStatus.PAGADO &&
      order.status !== OrderStatus.PAGADO &&
      !order.depositConfirmed;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        const claimed = await tx.order.updateMany({
          where: {
            id,
            status: order.status,
            depositConfirmed: order.depositConfirmed,
          },
          data,
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('El pedido ya cambió de estado');
        }
      }
      if (shouldRestore) {
        await this.restoreInventory(order.items, tx);
      }
      if (shouldDeduct) {
        await this.deductInventory(order.items, tx);
      }
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    }, STOCK_TRANSACTION);

    if (next === OrderStatus.ENVIADO) {
      await this.notifyCustomer(updated, 'shipped');
    }
    if (next === OrderStatus.CANCELADO) {
      await this.notifyCustomer(updated, 'canceled');
    }

    await this.notificationsService.emit({
      type: 'ORDER_STATUS_CHANGED',
      targetRole: Role.ADMIN,
      payload: {
        orderId: id,
        status: updated.status ?? '',
        readableId: updated.readableId,
      },
    });

    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return this.mapOrder(updated);
  }

  async deleteOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order || order.stage !== OrderStage.ORDER) {
      throw new NotFoundException('Pedido no encontrado');
    }
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id,
          status: order.status,
          depositConfirmed: order.depositConfirmed,
        },
        data: { status: OrderStatus.CANCELADO, canceledAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('El pedido ya cambió de estado');
      }
      if (isInventoryDeducted(order)) {
        await this.restoreInventory(order.items, tx);
      }
      await tx.order.delete({ where: { id } });
    }, STOCK_TRANSACTION);
    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return { id, deleted: true };
  }

  private async restoreInventory(
    items: { watchId: string; quantity: number }[],
    tx: Prisma.TransactionClient,
  ) {
    await restoreWatchStock(tx, items);
    this.cache.invalidateTag(CACHE_TAGS.catalog);
  }

  private async deductInventory(
    items: { watchId: string; quantity: number }[],
    tx: Prisma.TransactionClient,
  ) {
    await reserveWatchStock(tx, items, {
      message: 'Stock insuficiente para este reloj',
    });
    this.cache.invalidateTag(CACHE_TAGS.catalog);
  }
}
