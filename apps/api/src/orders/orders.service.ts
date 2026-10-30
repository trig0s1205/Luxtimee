import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderSource,
  OrderStage,
  OrderStatus,
  OrderType,
  PriceType,
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
import type { SpecialSalesQueryDto } from './dto/special-sale.dto';
import { CreateSpecialSaleDto } from './dto/special-sale.dto';
import { generateReadableId } from './order-pricing.util';
import {
  assertSpecialSaleInput,
  computeSpecialSaleProfit,
} from './special-sale.util';
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
    const searchWhere = buildOrderSearchWhere(options.search);
    if (searchWhere) filters.push(searchWhere);

    const where: Prisma.OrderWhereInput = {
      stage: OrderStage.ORDER,
      ...(options.type
        ? { type: options.type }
        : { type: { not: OrderType.ESPECIAL } }),
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
      type: { not: OrderType.ESPECIAL },
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

  async findSpecialSales(query: SpecialSalesQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.OrderWhereInput = {
      stage: OrderStage.ORDER,
      type: OrderType.ESPECIAL,
      canceledAt: null,
      ...(search
        ? {
            OR: [
              { specialNote: { contains: search, mode: 'insensitive' } },
              {
                specialSkuSnapshot: { contains: search, mode: 'insensitive' },
              },
              { readableId: { contains: search, mode: 'insensitive' } },
              {
                items: {
                  some: {
                    productName: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: orders.map((order) => this.toSpecialSale(order)),
      total,
      page,
      limit,
    };
  }

  async createSpecialSale(dto: CreateSpecialSaleDto) {
    const { note, salePrice } = assertSpecialSaleInput({
      salePrice: dto.salePrice,
      note: dto.note,
    });
    const watch = await this.prisma.watch.findFirst({
      where: { id: dto.watchId, deletedAt: null },
      include: { brand: { select: { name: true } } },
    });
    if (!watch) {
      throw new BadRequestException('El reloj no existe');
    }
    if (watch.stock <= 0) {
      throw new BadRequestException('Sin stock para este reloj');
    }
    if (watch.cost == null || watch.cost <= 0) {
      throw new BadRequestException('El reloj no tiene costo registrado');
    }

    const profit = computeSpecialSaleProfit(salePrice, watch.cost);
    const productName = `${watch.brand.name} ${watch.model}`.trim();
    const now = new Date();
    const readableId = generateReadableId((await this.prisma.order.count()) + 1);

    const order = await this.prisma.$transaction(async (tx) => {
      await reserveWatchStock(tx, [{ watchId: watch.id, quantity: 1 }], {
        message: 'Sin stock para este reloj',
      });
      return tx.order.create({
        data: {
          readableId,
          stage: OrderStage.ORDER,
          status: OrderStatus.ENTREGADO,
          type: OrderType.ESPECIAL,
          source: OrderSource.WEB,
          customerName: '',
          customerAddress: '',
          customerEmail: '',
          customerPhone: null,
          shippingCost: 0,
          depositExpected: 0,
          depositConfirmed: false,
          subtotal: salePrice,
          total: salePrice,
          paidAt: now,
          deliveredAt: now,
          specialNote: note,
          specialSalePrice: salePrice,
          specialCostSnapshot: watch.cost,
          specialListPriceSnapshot: watch.retailPrice,
          specialSkuSnapshot: watch.sku,
          specialProfit: profit,
          items: {
            create: [
              {
                watchId: watch.id,
                productName,
                productSku: watch.sku,
                productRef: watch.sku,
                productImage:
                  watch.frontImageUrl ??
                  watch.primaryImageUrl ??
                  watch.images[0] ??
                  null,
                quantity: 1,
                unitPrice: salePrice,
                priceType: PriceType.RETAIL,
              },
            ],
          },
        },
        include: orderInclude,
      });
    }, STOCK_TRANSACTION);

    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return this.toSpecialSale(order);
  }

  private toSpecialSale(order: {
    id: string;
    readableId: string;
    createdAt: Date;
    total: number;
    specialNote: string | null;
    specialSalePrice: number | null;
    specialCostSnapshot: number | null;
    specialListPriceSnapshot: number | null;
    specialSkuSnapshot: string | null;
    specialProfit: number | null;
    items: Array<{ productName: string; watch: { sku: string } }>;
  }) {
    const item = order.items[0];
    const salePrice = order.specialSalePrice ?? order.total;
    const cost = order.specialCostSnapshot ?? 0;
    return {
      id: order.id,
      readableId: order.readableId,
      createdAt: order.createdAt.toISOString(),
      watchName: item?.productName ?? '',
      sku: order.specialSkuSnapshot ?? item?.watch.sku ?? '',
      listPrice: order.specialListPriceSnapshot ?? 0,
      salePrice,
      cost,
      profit: order.specialProfit ?? salePrice - cost,
      note: order.specialNote ?? '',
    };
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
