import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  OrderStage,
  OrderSource,
  OrderType,
  PriceType,
  Prisma,
  Role,
} from '@prisma/client';
import {
  isAlwaysFreeShippingZone,
  PRE_ORDER_RESPONSE_HOURS,
  WHOLESALE_MIN_UNITS,
  type WholesaleQuotedLine,
} from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { WhatsappService } from '../integrations/whatsapp.service';
import {
  CreateManualPreOrderDto,
  CreatePreOrderDto,
  UpdatePreOrderDto,
} from './dto/pre-order.dto';
import {
  assertCanConfirmDeposit,
  assertPreOrderEditable,
  nextStatusAfterDeposit,
} from '../orders/state-machine';
import {
  generateReadableId,
  priceOrderLines,
} from '../orders/order-pricing.util';
import { formatWatchOrderLabel } from '../orders/watch-description.util';
import { WholesaleAccessService } from '../wholesale-access/wholesale-access.service';
import { WholesaleOffersService } from '../wholesale-offers/wholesale-offers.service';
import {
  reserveWatchStock,
  restoreWatchStock,
  STOCK_TRANSACTION,
} from '../common/utils/watch-stock.tx';
import { CustomerNotifier } from '../integrations/customer-notifier.service';
import type { CustomerOrderEvent } from '../integrations/customer-notifier.service';
import {
  buildCustomerWhatsappUrl,
  customerStatusWhatsappMessage,
} from '../integrations/customer-whatsapp';
import {
  mergePreOrderItems,
  parseExtrasSnapshot,
  repricePreservedWholesaleLine,
} from './pre-order-lines';

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

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

@Injectable()
export class PreOrdersService {
  private readonly logger = new Logger(PreOrdersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private settingsService: SettingsService,
    private whatsappService: WhatsappService,
    private wholesaleAccessService: WholesaleAccessService,
    private wholesaleOffers: WholesaleOffersService,
    private customerNotifier: CustomerNotifier,
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
        warrantyRegistered: false,
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
    event: CustomerOrderEvent,
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

  private preOrderExpiryThreshold() {
    return new Date(Date.now() - PRE_ORDER_RESPONSE_HOURS * 60 * 60 * 1000);
  }

  private async buildLines(
    items: {
      watchId: string;
      quantity: number;
      deliveryNote?: string | null;
      extras?: Array<{ extraId: string; quantity: number }>;
    }[],
  ) {
    if (!items.length) throw new BadRequestException('El carrito está vacío');
    const merged = mergePreOrderItems(items);
    const watches = await this.prisma.watch.findMany({
      where: { id: { in: merged.map((i) => i.watchId) }, isActive: true },
      include: { brand: true, category: true },
    });
    const byId = new Map(watches.map((watch) => [watch.id, watch]));
    return merged.map((item) => {
      const watch = byId.get(item.watchId);
      if (!watch)
        throw new BadRequestException(`Reloj no disponible: ${item.watchId}`);
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
        productSku: watch.sku,
        whatsappLabel,
        productRef: watch.slug,
        productImage: watch.frontImageUrl,
        deliveryNote: item.deliveryNote?.trim() || null,
        extras: (item.extras ?? []).filter((extra) => extra.quantity > 0),
      };
    });
  }

  private async priceChannel(
    lineInputs: Awaited<ReturnType<PreOrdersService['buildLines']>>,
    shippingCost: number,
    channel: 'retail' | 'wholesale',
  ) {
    if (channel !== 'wholesale') {
      const priced = priceOrderLines(lineInputs, shippingCost, channel);
      return {
        ...priced,
        lines: priced.lines.map((line) => ({
          ...line,
          extrasSnapshot: [] as Array<{
            extraId: string;
            name: string;
            unitPrice: number;
            quantity: number;
          }>,
          packageId: null as string | null,
          packageName: null as string | null,
        })),
      };
    }

    const quoted = await this.wholesaleOffers.quoteLines(
      lineInputs.map((line) => ({
        watchId: line.watchId,
        quantity: line.quantity,
        wholesalePrice: line.wholesalePrice,
        extras: line.extras,
      })),
    );
    const byWatch = indexQuotesByWatch(quoted.lines);
    const lines = lineInputs.map((line) => {
      const quote = byWatch.get(line.watchId);
      if (!quote) throw new BadRequestException('No se pudo cotizar el pedido');
      return {
        ...line,
        unitPrice: quote.unitPrice,
        priceType: PriceType.WHOLESALE,
        lineTotal: quote.lineTotal,
        extrasSnapshot: quote.extras,
        packageId: quote.packageId,
        packageName: quote.packageName,
      };
    });
    const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    return {
      type: OrderType.MAYORISTA,
      unitCount,
      subtotal,
      shippingCost,
      total: subtotal + shippingCost,
      depositExpected: 10_000 * unitCount,
      lines,
    };
  }

  private async priceWholesaleEdit(
    lineInputs: Awaited<ReturnType<PreOrdersService['buildLines']>>,
    shippingCost: number,
    existingItems: OrderWithRelations['items'],
  ) {
    const previousByWatch = new Map<
      string,
      OrderWithRelations['items'][number]
    >();
    for (const item of existingItems) {
      if (!previousByWatch.has(item.watchId))
        previousByWatch.set(item.watchId, item);
    }
    const fresh = lineInputs.filter(
      (line) => !previousByWatch.has(line.watchId),
    );
    let quotedByWatch = new Map<string, WholesaleQuotedLine>();
    if (fresh.length) {
      const quoted = await this.wholesaleOffers.quoteLines(
        lineInputs.map((line) => ({
          watchId: line.watchId,
          quantity: line.quantity,
          wholesalePrice: line.wholesalePrice,
          extras: previousByWatch.has(line.watchId) ? [] : line.extras,
        })),
      );
      quotedByWatch = indexQuotesByWatch(quoted.lines);
    }
    const hasFrozen = lineInputs.some((line) =>
      previousByWatch.has(line.watchId),
    );
    const catalog = hasFrozen
      ? await this.wholesaleOffers.getPublicCatalog()
      : null;

    const lines = lineInputs.map((line) => {
      const prev = previousByWatch.get(line.watchId);
      if (!prev) {
        const quote = quotedByWatch.get(line.watchId);
        if (!quote)
          throw new BadRequestException('No se pudo cotizar el pedido');
        return {
          ...line,
          unitPrice: quote.unitPrice,
          priceType: PriceType.WHOLESALE,
          lineTotal: quote.lineTotal,
          extrasSnapshot: quote.extras,
          packageId: quote.packageId,
          packageName: quote.packageName,
        };
      }
      let priced: ReturnType<typeof repricePreservedWholesaleLine>;
      try {
        priced = repricePreservedWholesaleLine({
          quantity: line.quantity,
          previousUnitPrice: prev.unitPrice,
          previousExtras: parseExtrasSnapshot(prev.extrasSnapshot),
          requestedExtras: line.extras,
          catalogExtras: catalog?.extras ?? [],
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'No se pudo cotizar el pedido';
        throw new BadRequestException(message);
      }
      return {
        ...line,
        unitPrice: priced.unitPrice,
        priceType: PriceType.WHOLESALE,
        lineTotal: priced.lineTotal,
        extrasSnapshot: priced.extras,
        packageId: prev.packageId,
        packageName: prev.packageName,
      };
    });
    const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    return {
      type: OrderType.MAYORISTA,
      unitCount,
      subtotal,
      shippingCost,
      total: subtotal + shippingCost,
      depositExpected: 10_000 * unitCount,
      lines,
    };
  }

  private async reservePreOrderStock(
    tx: Prisma.TransactionClient,
    items: Array<{ watchId: string; quantity: number; productName?: string }>,
  ) {
    const label = items.find((item) => item.productName)?.productName;
    await reserveWatchStock(tx, items, {
      requireActive: true,
      inactiveMessage: `Reloj no disponible${label ? `: ${label}` : ''}`,
      message: `Stock insuficiente para ${label ?? 'este reloj'}. Edita el pre-pedido con otro reloj.`,
    });
  }

  private async nextReadableId() {
    const count = await this.prisma.order.count();
    return generateReadableId(count + 1);
  }

  async createPublic(
    dto: CreatePreOrderDto,
    userId?: string,
    wholesaleToken?: string,
  ) {
    if (!dto.consentAccepted) {
      throw new BadRequestException(
        'Debe aceptar términos y política de datos',
      );
    }
    let channel: 'retail' | 'wholesale' = 'retail';
    let wholesaleAccessId: string | undefined;
    let customerEmail = '';
    let source: OrderSource = OrderSource.WEB;
    if (wholesaleToken) {
      const session =
        await this.wholesaleAccessService.getSessionFromToken(wholesaleToken);
      if (!session) {
        throw new UnauthorizedException(
          'Acceso mayorista requerido para este pedido',
        );
      }
      channel = 'wholesale';
      wholesaleAccessId = session.id;
      customerEmail = session.email ?? '';
      source = OrderSource.MAYORISTA;
    }
    return this.createOrder({
      dto,
      userId,
      wholesaleAccessId,
      customerEmail,
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
      return (
        orderDigits.endsWith(suffix) || suffix.endsWith(orderDigits.slice(-10))
      );
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
    customerEmail?: string;
    channel: 'retail' | 'wholesale';
    source: OrderSource;
    includeWhatsappUrl: boolean;
  }) {
    const {
      dto,
      userId,
      wholesaleAccessId,
      customerEmail,
      channel,
      source,
      includeWhatsappUrl,
    } = options;
    if (channel === 'wholesale') {
      this.assertWholesaleMinimum(dto.items);
    }
    const lineInputs = await this.buildLines(dto.items);
    let shippingCost = 0;
    let shippingZoneName: string | undefined;
    if (dto.shippingZoneId) {
      const zone = await this.prisma.shippingZone.findUnique({
        where: { id: dto.shippingZoneId },
      });
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
    const priced = await this.priceChannel(lineInputs, shippingCost, channel);
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
        sku: line.productSku,
        qty: line.quantity,
        price: line.unitPrice,
        deliveryNote: line.deliveryNote,
        extrasLabel: formatExtrasLabel(line.extrasSnapshot),
        packageName: line.packageName,
      })),
      total: priced.total,
      type: priced.type,
    });

    const now = new Date();
    const readableId = await this.nextReadableId();
    const order = await this.prisma.$transaction(async (tx) => {
      await reserveWatchStock(tx, lineInputs);

      return tx.order.create({
        data: {
          readableId,
          stage: OrderStage.PRE_ORDER,
          type: priced.type,
          source,
          customerName: dto.customerName,
          customerAddress: dto.customerAddress,
          customerEmail: customerEmail?.trim() || '',
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
              productSku: line.productSku || '',
              productRef: line.productRef,
              productImage: line.productImage,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              priceType: line.priceType,
              deliveryNote: line.deliveryNote,
              extrasSnapshot: line.extrasSnapshot,
              packageId: line.packageId,
              packageName: line.packageName,
            })),
          },
        },
        include: orderInclude,
      });
    }, STOCK_TRANSACTION);

    await this.notificationsService.emit({
      type: 'NEW_PRE_ORDER',
      targetRole: Role.ADMIN,
      payload: { orderId: order.id, readableId: order.readableId },
    });
    await this.notifyCustomer(order, 'created');

    const mapped = this.mapOrder(order);
    if (!includeWhatsappUrl) {
      return { order: mapped };
    }
    const whatsappUrl = this.whatsappService.buildRedirectUrl(
      whatsapp.url,
      message,
    );
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
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.mapOrder(order);
  }

  async updatePreOrder(id: string, dto: UpdatePreOrderDto) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    assertPreOrderEditable(existing.stage, existing.canceledAt);

    const isSuspended = !!existing.suspendedAt;

    let pricingPatch: Record<string, unknown> = {};
    let autoReactivate = false;
    let stockLines: Array<{
      watchId: string;
      quantity: number;
      productName: string;
    }> = [];

    if (dto.items) {
      const channel =
        existing.type === OrderType.MAYORISTA ? 'wholesale' : 'retail';
      if (channel === 'wholesale') {
        this.assertWholesaleMinimum(dto.items);
      }
      const items =
        channel === 'wholesale'
          ? dto.items.map((item) => {
              if (item.extras) return item;
              const prev = existing.items.find(
                (row) => row.watchId === item.watchId,
              );
              return {
                ...item,
                extras: snapshotToSelections(prev?.extrasSnapshot),
              };
            })
          : dto.items;
      const lineInputs = await this.buildLines(items);
      stockLines = lineInputs.map((line) => ({
        watchId: line.watchId,
        quantity: line.quantity,
        productName: line.productName,
      }));
      let shippingCost = existing.shippingCost;
      if (dto.shippingZoneId) {
        const zone = await this.prisma.shippingZone.findUnique({
          where: { id: dto.shippingZoneId },
        });
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
          ? await this.prisma.shippingZone.findUnique({
              where: { id: existing.shippingZoneId },
            })
          : null;
        if (currentZone?.isManualCost) {
          shippingCost = Math.max(0, Math.round(dto.manualShippingCost));
        }
      }
      const priced =
        channel === 'wholesale'
          ? await this.priceWholesaleEdit(
              lineInputs,
              shippingCost,
              existing.items,
            )
          : await this.priceChannel(lineInputs, shippingCost, channel);
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
            productSku: line.productSku || '',
            productRef: line.productRef,
            productImage: line.productImage,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            priceType: line.priceType,
            deliveryNote: line.deliveryNote,
            extrasSnapshot: line.extrasSnapshot,
            packageId: line.packageId,
            packageName: line.packageName,
          })),
        },
      };

      if (isSuspended) {
        autoReactivate = true;
      }
    } else if (isSuspended) {
      throw new BadRequestException(
        'Reactiva el pre-pedido suspendido antes de editarlo',
      );
    }

    const updateData = {
      ...(dto.customerName !== undefined && !isSuspended
        ? { customerName: dto.customerName }
        : {}),
      ...(dto.customerAddress !== undefined && !isSuspended
        ? { customerAddress: dto.customerAddress }
        : {}),
      ...(dto.customerPhone !== undefined && !isSuspended
        ? { customerPhone: dto.customerPhone }
        : {}),
      ...(dto.shippingZoneId !== undefined
        ? { shippingZoneId: dto.shippingZoneId }
        : {}),
      ...(autoReactivate
        ? { suspendedAt: null, preOrderActiveAt: new Date() }
        : {}),
      ...pricingPatch,
    };

    if (!dto.items) {
      const order = await this.prisma.order.update({
        where: { id },
        data: updateData,
        include: orderInclude,
      });
      return this.mapOrder(order);
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE
      `;
      if (!locked.length) {
        throw new NotFoundException('Pre-pedido no encontrado');
      }
      const current = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) throw new NotFoundException('Pre-pedido no encontrado');
      assertPreOrderEditable(current.stage, current.canceledAt);
      if (!current.suspendedAt) {
        await restoreWatchStock(tx, current.items);
      }
      await this.reservePreOrderStock(tx, stockLines);
      return tx.order.update({
        where: { id },
        data: {
          ...updateData,
          ...(current.suspendedAt
            ? { suspendedAt: null, preOrderActiveAt: new Date() }
            : {}),
        },
        include: orderInclude,
      });
    }, STOCK_TRANSACTION);
    return this.mapOrder(order);
  }

  private assertWholesaleMinimum(
    items: Array<{
      watchId: string;
      quantity: number;
      deliveryNote?: string | null;
      extras?: Array<{ extraId: string; quantity: number }>;
    }>,
  ) {
    const totalQty = mergePreOrderItems(items).reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    if (totalQty < WHOLESALE_MIN_UNITS) {
      throw new BadRequestException(
        `El pedido mínimo mayorista es de ${WHOLESALE_MIN_UNITS} unidades`,
      );
    }
  }

  async deletePreOrder(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          stage: string;
          suspendedAt: Date | null;
          canceledAt: Date | null;
        }>
      >`
        SELECT id, stage::text AS stage, "suspendedAt", "canceledAt"
        FROM "Order"
        WHERE id = ${id}
        FOR UPDATE
      `;
      const existing = locked[0];
      if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
      if (existing.stage !== OrderStage.PRE_ORDER) {
        throw new BadRequestException('Solo se pueden eliminar pre-pedidos');
      }
      if (!existing.suspendedAt && !existing.canceledAt) {
        const items = await tx.orderItem.findMany({
          where: { orderId: id },
          select: { watchId: true, quantity: true },
        });
        await restoreWatchStock(tx, items);
      }
      await tx.order.delete({ where: { id } });
    }, STOCK_TRANSACTION);
    return { id, deleted: true };
  }

  async confirmDeposit(id: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    assertCanConfirmDeposit(
      existing.stage,
      existing.depositConfirmed,
      existing.canceledAt,
    );
    if (existing.suspendedAt) {
      throw new BadRequestException(
        'Reactiva el pre-pedido antes de confirmar el abono',
      );
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
    await this.notifyCustomer(order, 'deposit_confirmed');

    return this.mapOrder(order);
  }

  async reactivatePreOrder(id: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
    if (existing.stage !== OrderStage.PRE_ORDER || existing.canceledAt) {
      throw new BadRequestException('No se puede reactivar este pre-pedido');
    }
    if (!existing.suspendedAt) {
      throw new BadRequestException('El pre-pedido ya está activo');
    }

    const now = new Date();
    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id,
          stage: OrderStage.PRE_ORDER,
          canceledAt: null,
          suspendedAt: { not: null },
        },
        data: { suspendedAt: null, preOrderActiveAt: now },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('El pre-pedido ya está activo');
      }
      const items = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { watchId: true, quantity: true, productName: true },
      });
      await this.reservePreOrderStock(tx, items);
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    }, STOCK_TRANSACTION);

    await this.notificationsService.emit({
      type: 'PRE_ORDER_REACTIVATED',
      targetRole: Role.ADMIN,
      payload: { orderId: order.id, readableId: order.readableId },
    });

    return this.mapOrder(order);
  }

  async cancelPreOrder(id: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Pre-pedido no encontrado');
      assertPreOrderEditable(existing.stage, existing.canceledAt);
      const now = new Date();
      const activeClaim = await tx.order.updateMany({
        where: {
          id,
          stage: OrderStage.PRE_ORDER,
          canceledAt: null,
          suspendedAt: null,
        },
        data: { canceledAt: now },
      });
      if (activeClaim.count === 1) {
        const items = await tx.orderItem.findMany({
          where: { orderId: id },
          select: { watchId: true, quantity: true },
        });
        await restoreWatchStock(tx, items);
      } else {
        const suspendedClaim = await tx.order.updateMany({
          where: {
            id,
            stage: OrderStage.PRE_ORDER,
            canceledAt: null,
            suspendedAt: { not: null },
          },
          data: { canceledAt: now },
        });
        if (suspendedClaim.count !== 1) {
          throw new BadRequestException(
            'Solo se pueden editar pre-pedidos activos',
          );
        }
      }
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    }, STOCK_TRANSACTION);
    await this.notifyCustomer(order, 'canceled');
    return this.mapOrder(order);
  }

  async countPreOrders() {
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
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        wholesaleAccessId: true,
      },
    });

    if (!expired.length) return 0;

    const now = new Date();
    let suspended = 0;
    for (const order of expired) {
      const didSuspend = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            suspendedAt: null,
            canceledAt: null,
            stage: OrderStage.PRE_ORDER,
            depositConfirmed: false,
          },
          data: { suspendedAt: now },
        });
        if (updated.count !== 1) return false;
        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          select: { watchId: true, quantity: true },
        });
        await restoreWatchStock(tx, items);
        return true;
      }, STOCK_TRANSACTION);
      if (!didSuspend) continue;
      suspended += 1;
      await this.notificationsService.emit({
        type: 'PRE_ORDER_SUSPENDED',
        targetRole: Role.ADMIN,
        payload: { orderId: order.id, readableId: order.readableId },
      });
      await this.notifyCustomer(order, 'suspended');
    }

    return suspended;
  }
}

function snapshotToSelections(raw: unknown) {
  return parseExtrasSnapshot(raw).map(({ extraId, quantity }) => ({
    extraId,
    quantity,
  }));
}

function indexQuotesByWatch<T extends { watchId: string }>(lines: T[]) {
  const byWatch = new Map<string, T>();
  for (const line of lines) {
    if (byWatch.has(line.watchId)) {
      throw new BadRequestException('El pedido repite un reloj');
    }
    byWatch.set(line.watchId, line);
  }
  return byWatch;
}

function formatExtrasLabel(extras: Array<{ name: string; quantity: number }>) {
  const parts = extras
    .filter((extra) => extra.quantity > 0)
    .map((extra) => `${extra.quantity} ${extra.name} extra por reloj`);
  return parts.length ? parts.join(', ') : null;
}
