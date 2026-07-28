import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStage, Prisma, Role } from '@prisma/client';
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

@Injectable()
export class PreOrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private settingsService: SettingsService,
    private whatsappService: WhatsappService,
    private config: ConfigService,
  ) {}

  private mapOrder(order: Prisma.OrderGetPayload<{ include: { items: true } }>) {
    return {
      ...order,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      canceledAt: order.canceledAt?.toISOString() ?? null,
    };
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

  async createPublic(dto: CreatePreOrderDto, userId?: string) {
    if (!dto.consentAccepted) {
      throw new BadRequestException('Debe aceptar términos y política de datos');
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
    const priced = priceOrderLines(lineInputs, shippingCost);
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
        shippingZoneId: dto.shippingZoneId,
        shippingCost: priced.shippingCost,
        depositExpected: priced.depositExpected,
        subtotal: priced.subtotal,
        total: priced.total,
        whatsappMessage: message,
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

  async findAllPreOrders() {
    const orders = await this.prisma.order.findMany({
      where: { stage: OrderStage.PRE_ORDER, canceledAt: null },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => this.mapOrder(o));
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

    let pricingPatch: Record<string, unknown> = {};
    if (dto.items) {
      const lineInputs = await this.buildLines(dto.items);
      const shippingCost = dto.shippingZoneId
        ? (await this.prisma.shippingZone.findUnique({ where: { id: dto.shippingZoneId } }))?.cost ?? existing.shippingCost
        : existing.shippingCost;
      const priced = priceOrderLines(lineInputs, shippingCost);
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

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        stage: OrderStage.ORDER,
        status: nextStatusAfterDeposit(),
        depositConfirmed: true,
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

  async countActivePreOrders() {
    return this.prisma.order.count({
      where: { stage: OrderStage.PRE_ORDER, canceledAt: null },
    });
  }
}
