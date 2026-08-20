import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OrderStage, OrderSource, OrderType, Prisma, Role } from '@prisma/client';
import { isAlwaysFreeShippingZone, PRE_ORDER_RESPONSE_HOURS } from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { WhatsappService } from '../integrations/whatsapp.service';
import { CreateManualPreOrderDto, CreatePreOrderDto, UpdatePreOrderDto } from './dto/pre-order.dto';
import {
  assertCanConfirmDeposit,
  assertPreOrderEditable,
  nextStatusAfterDeposit,
} from '../orders/state-machine';
import { generateReadableId, priceOrderLines } from '../orders/order-pricing.util';
import { formatWatchOrderLabel } from '../orders/watch-description.util';
import { WholesaleAccessService } from '../wholesale-access/wholesale-access.service';
import { storefrontHideWhenEmpty } from '../common/utils/storefront-stock.util';

const activePreOrderWhere = {
  stage: OrderStage.PRE_ORDER,
  canceledAt: null,
  suspendedAt: null,
  depositConfirmed: false,
} as const;

const suspendedPreOrderWhere = {
  stage: OrderStage.PRE_ORDER,
  canceledAt: null,
  suspendedAt: { not: null },
  depositConfirmed: false,
} as const;

const orderInclude = {
  items: {
    include: {
      watch: { select: { sku: true, frontImageUrl: true } },
    },
  },
  shippingZone: true,
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class PreOrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private settingsService: SettingsService,
    private whatsappService: WhatsappService,
    private wholesaleAccessService: WholesaleAccessService,
  ) {}

  private mapOrder(order: OrderWithRelations) {
    const { items, shippingZone, ...rest } = order;
    return {
      ...rest,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      preOrderActiveAt: order.preOrderActiveAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      canceledAt: order.canceledAt?.toISOString() ?? null,
      suspendedAt: order.suspendedAt?.toISOString() ?? null,
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
        warrantyRegistered: false,
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

  private preOrderExpiryThreshold() {
    return new Date(Date.now() - PRE_ORDER_RESPONSE_HOURS * 60 * 60 * 1000);
  }

  private async buildLines(items: { watchId: string; quantity: number; deliveryNote?: string | null }[]) {
    if (!items.length) throw new BadRequestException('El carrito está vacío');
    const watches = await this.prisma.watch.findMany({
      where: { id: { in: items.map((i) => i.watchId) }, isActive: true },
      include: { brand: true, category: true },
    });
    const lines = items.map((item) => {
      const watch = watches.find((w) => w.id === item.watchId);
      if (!watch) throw new BadRequestException(`Reloj no disponible: ${item.watchId}`);
      if (watch.stock < item.quantity) {
        throw new BadRequestException(`Stock insuficiente para ${watch.model}`);
      }
      const whatsappLabel = formatWatchOrderLabel(watch);
      return {
        watchId: watch.id,
        quantity: item.quantity,
        retailPrice: watch.retailPrice,
        wholesalePrice: watch.wholesalePrice,
        productName: whatsappLabel,
        whatsappLabel,
        productRef: watch.slug,
        productImage: watch.frontImageUrl,
        deliveryNote: item.deliveryNote?.trim() || null,
      };
    });
    return lines;
  }

  private async nextReadableId() {
    const count = await this.prisma.order.count();
    return generateReadableId(count + 1);
  }

  async createPublic(dto: CreatePreOrderDto, userId?: string, wholesaleToken?: string) {
    if (!dto.consentAccepted) {
      throw new BadRequestException('Debe aceptar términos y política de datos');
    }
    let channel: 'retail' | 'wholesale' = 'retail';
    let wholesaleAccessId: string | undefined;
    let source: OrderSource = OrderSource.WEB;
    if (wholesaleToken) {
      const session = await this.wholesaleAccessService.getSessionFromToken(wholesaleToken);
      if (!session) {
        throw new UnauthorizedException('Acceso mayorista requerido para este pedido');
      }
      channel = 'wholesale';
      wholesaleAccessId = session.id;
      source = OrderSource.MAYORISTA;
    }
    return this.createOrder({
      dto,
      userId,
      wholesaleAccessId,
      channel,
      source,
      includeWhatsappUrl: true,
    });
  }

  async createManual(dto: CreateManualPreOrderDto) {
    return this.createOrder({
      dto,
      channel: 'retail',
      source: OrderSource.WHATSAPP,
      includeWhatsappUrl: false,
    });
  }

  async findCustomerHint(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      throw new BadRequestException('Teléfono inválido');
    }
    const orders = await this.prisma.order.findMany({
      where: {
        customerPhone: { not: null },
        canceledAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        customerName: true,
        customerAddress: true,
        customerPhone: true,
        shippingZoneId: true,
      },
    });
    const suffix = digits.slice(-10);
    const match = orders.find((order) => {
      const orderDigits = order.customerPhone?.replace(/\D/g, '') ?? '';
      if (!orderDigits) return false;
      return orderDigits.endsWith(suffix) || suffix.endsWith(orderDigits.slice(-10));
    });
    if (!match) return null;
    return {
      customerName: match.customerName,
      customerAddress: match.customerAddress,
      customerPhone: match.customerPhone,
      shippingZoneId: match.shippingZoneId,
    };
  }

  private async createOrder(options: {
    dto: CreatePreOrderDto | CreateManualPreOrderDto;
    userId?: string;
    wholesaleAccessId?: string;
    channel: 'retail' | 'wholesale';
    source: OrderSource;
    includeWhatsappUrl: boolean;
  }) {
    const { dto, userId, wholesaleAccessId, channel, source, includeWhatsappUrl } = options;
    if (channel === 'wholesale') {
      const totalQty = dto.items.reduce((sum, i) => sum + i.quantity, 0);
      if (totalQty < 4) {
        throw new BadRequestException('El pedido mínimo mayorista es de 4 unidades');
      }
    }
    const lineInputs = await this.buildLines(dto.items);
    let shippingCost = 0;
    let shippingZoneName: string | undefined;
    if (dto.shippingZoneId) {
      const zone = await this.prisma.shippingZone.findUnique({ where: { id: dto.shippingZoneId } });
      if (!zone) throw new BadRequestException('Zona de envío inválida');
      if (isAlwaysFreeShippingZone(zone.name)) {
        shippingCost = 0;
      } else if (zone.isManualCost) {
        shippingCost = Math.max(0, Math.round(dto.manualShippingCost ?? 0));
      } else {
        shippingCost = zone.cost;
      }
      shippingZoneName = zone.name;
    }
    const priced = priceOrderLines(lineInputs, shippingCost, channel);
    const whatsapp = await this.settingsService.getWhatsappLink();
    const message = this.whatsappService.buildCheckoutMessage({
      prefix: whatsapp.messagePrefix,
      customerName: dto.customerName,
      customerAddress: dto.customerAddress,
      customerPhone: dto.customerPhone,
      shippingZoneName,
      shippingCost: priced.shippingCost,
      items: priced.lines.map((line) => ({
        label: line.whatsappLabel ?? line.productName,
        qty: line.quantity,
        price: line.unitPrice,
        deliveryNote: line.deliveryNote,
      })),
      total: priced.total,
      type: priced.type,
    });

    const now = new Date();
    const readableId = await this.nextReadableId();
    const order = await this.prisma.$transaction(async (tx) => {
      for (const line of lineInputs) {
        const watch = await tx.watch.findUnique({
          where: { id: line.watchId },
          select: { stock: true },
        });
        if (!watch || watch.stock < line.quantity) {
          throw new BadRequestException('Stock insuficiente para este reloj');
        }
        const newStock = watch.stock - line.quantity;
        await tx.watch.update({
          where: { id: line.watchId },
          data: {
            stock: newStock,
            ...(newStock === 0 ? storefrontHideWhenEmpty(0) : {}),
          },
        });
      }

      return tx.order.create({
        data: {
          readableId,
          stage: OrderStage.PRE_ORDER,
          type: priced.type,
          source,
          customerName: dto.customerName,
          customerAddress: dto.customerAddress,
          customerEmail: '',
          customerPhone: dto.customerPhone,
          userId,
          wholesaleAccessId,
          shippingZoneId: dto.shippingZoneId,
          shippingCost: priced.shippingCost,
          depositExpected: priced.depositExpected,
          subtotal: priced.subtotal,
          total: priced.total,
          whatsappMessage: message,
          preOrderActiveAt: now,
          items: {
            create: priced.lines.map((line) => ({
              watchId: line.watchId,
              productName: line.productName,
              productRef: line.productRef,
              productImage: line.productImage,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              priceType: line.priceType,
              deliveryNote: line.deliveryNote,
            })),
          },
        },
        include: orderInclude,
      });
    });

    await this.notificationsService.emit({
      type: 'NEW_PRE_ORDER',
      targetRole: Role.ADMIN,
      payload: { orderId: order.id, readableId: order.readableId },
    });

    const mapped = this.mapOrder(order);
    if (!includeWhatsappUrl) {
      return { order: mapped };
    }
    const whatsappUrl = this.whatsappService.buildRedirectUrl(whatsapp.url, message);
    return { order: mapped, whatsappUrl };
  }

  async findActivePreOrders(page = 1, limit = 10) {
    await this.suspendExpiredPreOrders();
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const where = activePreOrderWhere;
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { preOrderActiveAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);
    return {
      items: orders.map((o) => this.mapOrder(o)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async findSuspendedPreOrders(page = 1, limit = 10) {
    await this.suspendExpiredPreOrders();
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const where = suspendedPreOrderWhere;
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { suspendedAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);
    return {
      items: orders.map((o) => this.mapOrder(o)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.mapOrder(order);
  }

  async updatePreOrder(id: string, dto: UpdatePreOrderDto) {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    assertPreOrderEditable(existing.stage, existing.canceledAt);

    const isSuspended = !!existing.suspendedAt;

    let pricingPatch: Record<string, unknown> = {};
    let autoReactivate = false;

    if (dto.items) {
      const lineInputs = await this.buildLines(dto.items);
      let shippingCost = existing.shippingCost;
      if (dto.shippingZoneId) {
        const zone = await this.prisma.shippingZone.findUnique({ where: { id: dto.shippingZoneId } });
        if (zone) {
          if (isAlwaysFreeShippingZone(zone.name)) {
            shippingCost = 0;
          } else if (zone.isManualCost) {
            shippingCost = Math.max(0, Math.round(dto.manualShippingCost ?? 0));
          } else {
            shippingCost = zone.cost;
          }
        }
      } else if (dto.manualShippingCost !== undefined) {
        const currentZone = existing.shippingZoneId
          ? await this.prisma.shippingZone.findUnique({ where: { id: existing.shippingZoneId } })
          : null;
        if (currentZone?.isManualCost) {
          shippingCost = Math.max(0, Math.round(dto.manualShippingCost));
        }
      }
      const channel = existing.type === OrderType.MAYORISTA ? 'wholesale' : 'retail';
      const priced = priceOrderLines(lineInputs, shippingCost, channel);
      pricingPatch = {
        type: priced.type,
        subtotal: priced.subtotal,
        total: priced.total,
        depositExpected: priced.depositExpected,
        shippingCost: priced.shippingCost,
        items: {
          deleteMany: {},
          create: priced.lines.map((line) => ({
            watchId: line.watchId,
            productName: line.productName,
            productRef: line.productRef,
            productImage: line.productImage,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            priceType: line.priceType,
            deliveryNote: line.deliveryNote,
          })),
        },
      };

      if (isSuspended) {
        const hasEnoughStock = dto.items.every((item) => {
          const watch = lineInputs.find((l) => l.watchId === item.watchId);
          return watch !== undefined;
        });
        if (hasEnoughStock) autoReactivate = true;
      }
    } else if (isSuspended) {
      throw new BadRequestException('Reactiva el pre-pedido suspendido antes de editarlo');
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.customerName !== undefined && !isSuspended ? { customerName: dto.customerName } : {}),
        ...(dto.customerAddress !== undefined && !isSuspended ? { customerAddress: dto.customerAddress } : {}),
        ...(dto.customerPhone !== undefined && !isSuspended ? { customerPhone: dto.customerPhone } : {}),
        ...(dto.shippingZoneId !== undefined ? { shippingZoneId: dto.shippingZoneId } : {}),
        ...(autoReactivate ? { suspendedAt: null, preOrderActiveAt: new Date() } : {}),
        ...pricingPatch,
      },
      include: orderInclude,
    });
    return this.mapOrder(order);
  }

  async deletePreOrder(id: string) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    if (existing.stage !== OrderStage.PRE_ORDER) {
      throw new BadRequestException('Solo se pueden eliminar pre-pedidos');
    }
    await this.prisma.order.delete({ where: { id } });
    return { id, deleted: true };
  }

  async confirmDeposit(id: string) {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    assertCanConfirmDeposit(existing.stage, existing.depositConfirmed, existing.canceledAt);
    if (existing.suspendedAt) {
      throw new BadRequestException('Reactiva el pre-pedido antes de confirmar el abono');
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        stage: OrderStage.ORDER,
        status: nextStatusAfterDeposit(),
        depositConfirmed: true,
        suspendedAt: null,
      },
      include: orderInclude,
    });

    await this.notificationsService.emit({
      type: 'PRE_ORDER_CONFIRMED',
      targetRole: Role.ADMIN,
      payload: { orderId: order.id, readableId: order.readableId },
    });

    return this.mapOrder(order);
  }

  async reactivatePreOrder(id: string) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    if (existing.stage !== OrderStage.PRE_ORDER || existing.canceledAt) {
      throw new BadRequestException('No se puede reactivar este pre-pedido');
    }
    if (!existing.suspendedAt) {
      throw new BadRequestException('El pre-pedido ya está activo');
    }

    const now = new Date();
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        suspendedAt: null,
        preOrderActiveAt: now,
      },
      include: orderInclude,
    });

    await this.notificationsService.emit({
      type: 'PRE_ORDER_REACTIVATED',
      targetRole: Role.ADMIN,
      payload: { orderId: order.id, readableId: order.readableId },
    });

    return this.mapOrder(order);
  }

  async cancelPreOrder(id: string) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    assertPreOrderEditable(existing.stage, existing.canceledAt);
    const order = await this.prisma.order.update({
      where: { id },
      data: { canceledAt: new Date() },
      include: orderInclude,
    });
    return this.mapOrder(order);
  }

  async countPreOrders() {
    await this.suspendExpiredPreOrders();
    const [active, suspended] = await Promise.all([
      this.prisma.order.count({ where: activePreOrderWhere }),
      this.prisma.order.count({ where: suspendedPreOrderWhere }),
    ]);
    return { active, suspended };
  }

  async countActivePreOrders() {
    const counts = await this.countPreOrders();
    return counts.active;
  }

  async suspendExpiredPreOrders() {
    const threshold = this.preOrderExpiryThreshold();
    const expired = await this.prisma.order.findMany({
      where: {
        ...activePreOrderWhere,
        preOrderActiveAt: { lt: threshold },
      },
      select: {
        id: true,
        readableId: true,
        items: { select: { watchId: true, quantity: true } },
      },
    });

    if (!expired.length) return 0;

    const now = new Date();
    await this.prisma.order.updateMany({
      where: { id: { in: expired.map((order) => order.id) } },
      data: { suspendedAt: now },
    });

    for (const order of expired) {
      for (const item of order.items) {
        await this.prisma.watch.update({
          where: { id: item.watchId },
          data: { stock: { increment: item.quantity } },
        });
        const watch = await this.prisma.watch.findUnique({
          where: { id: item.watchId },
          select: { stock: true },
        });
        if (watch && watch.stock > 0) {
          await this.prisma.watch.update({
            where: { id: item.watchId },
            data: { showInCatalog: true },
          });
        }
      }

      await this.notificationsService.emit({
        type: 'PRE_ORDER_SUSPENDED',
        targetRole: Role.ADMIN,
        payload: { orderId: order.id, readableId: order.readableId },
      });
    }

    return expired.length;
  }
}
