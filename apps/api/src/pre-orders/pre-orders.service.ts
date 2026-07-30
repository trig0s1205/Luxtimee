import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OrderStage, OrderType, Prisma, Role } from '@prisma/client';
import { PRE_ORDER_RESPONSE_HOURS } from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { WhatsappService } from '../integrations/whatsapp.service';
import { CreatePreOrderDto, UpdatePreOrderDto } from './dto/pre-order.dto';
import {
  assertCanConfirmDeposit,
  assertPreOrderEditable,
  nextStatusAfterDeposit,
} from '../orders/state-machine';
import { generateReadableId, priceOrderLines } from '../orders/order-pricing.util';
import { formatWatchOrderLabel } from '../orders/watch-description.util';
import { WholesaleAccessService } from '../wholesale-access/wholesale-access.service';

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

@Injectable()
export class PreOrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private settingsService: SettingsService,
    private whatsappService: WhatsappService,
    private wholesaleAccessService: WholesaleAccessService,
  ) {}

  private mapOrder(order: Prisma.OrderGetPayload<{ include: { items: true } }>) {
    return {
      ...order,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      preOrderActiveAt: order.preOrderActiveAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      canceledAt: order.canceledAt?.toISOString() ?? null,
      suspendedAt: order.suspendedAt?.toISOString() ?? null,
    };
  }

  private preOrderExpiryThreshold() {
    return new Date(Date.now() - PRE_ORDER_RESPONSE_HOURS * 60 * 60 * 1000);
  }

  private async buildLines(items: { watchId: string; quantity: number }[]) {
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
    if (wholesaleToken) {
      const session = await this.wholesaleAccessService.getSessionFromToken(wholesaleToken);
      if (!session) {
        throw new UnauthorizedException('Acceso mayorista requerido para este pedido');
      }
      channel = 'wholesale';
      wholesaleAccessId = session.id;
    }
    const lineInputs = await this.buildLines(dto.items);
    let shippingCost = 0;
    let shippingZoneName: string | undefined;
    if (dto.shippingZoneId) {
      const zone = await this.prisma.shippingZone.findUnique({ where: { id: dto.shippingZoneId } });
      if (!zone) throw new BadRequestException('Zona de envío inválida');
      shippingCost = zone.cost;
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
      })),
      total: priced.total,
      type: priced.type,
    });

    const now = new Date();
    const order = await this.prisma.order.create({
      data: {
        readableId: await this.nextReadableId(),
        stage: OrderStage.PRE_ORDER,
        type: priced.type,
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
          })),
        },
      },
      include: { items: true },
    });

    await this.notificationsService.emit({
      type: 'NEW_PRE_ORDER',
      targetRole: Role.ADMIN,
      payload: { orderId: order.id, readableId: order.readableId },
    });

    const whatsappUrl = this.whatsappService.buildRedirectUrl(whatsapp.url, message);
    return { order: this.mapOrder({ ...order, whatsappMessage: message }), whatsappUrl };
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
        include: { items: true },
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
        include: { items: true },
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
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.mapOrder(order);
  }

  async updatePreOrder(id: string, dto: UpdatePreOrderDto) {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    assertPreOrderEditable(existing.stage, existing.canceledAt);
    if (existing.suspendedAt) {
      throw new BadRequestException('Reactiva el pre-pedido suspendido antes de editarlo');
    }

    let pricingPatch: Record<string, unknown> = {};
    if (dto.items) {
      const lineInputs = await this.buildLines(dto.items);
      const shippingCost = dto.shippingZoneId
        ? (await this.prisma.shippingZone.findUnique({ where: { id: dto.shippingZoneId } }))?.cost ?? existing.shippingCost
        : existing.shippingCost;
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
          })),
        },
      };
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.customerName !== undefined ? { customerName: dto.customerName } : {}),
        ...(dto.customerAddress !== undefined ? { customerAddress: dto.customerAddress } : {}),
        ...(dto.customerPhone !== undefined ? { customerPhone: dto.customerPhone } : {}),
        ...(dto.shippingZoneId !== undefined ? { shippingZoneId: dto.shippingZoneId } : {}),
        ...pricingPatch,
      },
      include: { items: true },
    });
    return this.mapOrder(order);
  }

  async confirmDeposit(id: string) {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
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
      include: { items: true },
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
      include: { items: true },
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
      include: { items: true },
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
      select: { id: true, readableId: true },
    });

    if (!expired.length) return 0;

    const now = new Date();
    await this.prisma.order.updateMany({
      where: { id: { in: expired.map((order) => order.id) } },
      data: { suspendedAt: now },
    });

    for (const order of expired) {
      await this.notificationsService.emit({
        type: 'PRE_ORDER_SUSPENDED',
        targetRole: Role.ADMIN,
        payload: { orderId: order.id, readableId: order.readableId },
      });
    }

    return expired.length;
  }
}
