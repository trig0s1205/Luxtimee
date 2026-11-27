import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderPaymentType,
  OrderSource,
  OrderStage,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PriceType,
  Prisma,
  Role,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  cashClosingNoteValid,
  expectedDrawerCash,
  resolvePosDiscount,
  type PosCashClosingDto,
  type PosCashClosingPreviewDto,
  type PosCashClosingsPageDto,
  type PosCashOutDto,
  type PosCashSaleLineDto,
  type PosCustomerHintDto,
  type PosMySaleDto,
  type PosSaleResultDto,
  type PosVoidSaleResultDto,
} from '@luxtime/shared';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  reserveWatchStock,
  restoreWatchStock,
  STOCK_TRANSACTION,
} from '../common/utils/watch-stock.tx';
import { sanitizePlainText } from '../common/utils/sanitize-text.util';
import { ImageProcessingService } from '../integrations/image-processing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { nextOrderReadableId } from '../common/utils/document-counter.util';
import { withTxnRetries } from '../common/utils/txn-retries.util';
import { PrismaService } from '../prisma/prisma.service';
import { expenseDate } from '../expenses/expenses.service';
import {
  bogotaDayRange,
  todayBogotaYmd,
} from '../receipts/bogota-time.util';
import { validatePosPayments } from '../receipts/payments.util';
import { ReceiptsService } from '../receipts/receipts.service';
import {
  CreateCashClosingDto,
  CreateCashOutDto,
  CreatePosSaleDto,
  PosMySalesQueryDto,
} from './dto/pos.dto';
import { renderCashClosingPdf } from './cash-closing-pdf';
import { PosCatalogService } from './pos-catalog.service';

const POS_SALE_TX = { maxWait: 3_000, timeout: 8_000 } as const;

function isIdempotencyConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta?.target ?? '').includes('posIdempotencyKey')
  );
}

function discountOrThrow(
  gross: number,
  amount?: number,
  percent?: number,
) {
  const resolved = resolvePosDiscount(gross, { amount, percent });
  if (resolved.ok === false) throw new BadRequestException(resolved.message);
  return resolved.discount;
}

function toClosingDto(
  row: {
    id: string;
    businessDate: Date;
    userId: string;
    openingCash: number;
    countedCash: number;
    expectedCash: number;
    difference: number;
    totalCash: number;
    totalTransfer: number;
    totalCard: number;
    totalOther: number;
    totalSales: number;
    salesCount: number;
    cashOutTotal?: number | null;
    notes: string | null;
    createdAt: Date;
    user?: { name: string } | null;
  },
): PosCashClosingDto {
  const ymd =
    row.businessDate instanceof Date
      ? row.businessDate.toISOString().slice(0, 10)
      : String(row.businessDate).slice(0, 10);
  return {
    id: row.id,
    businessDate: ymd,
    userId: row.userId,
    userName: row.user?.name ?? null,
    openingCash: row.openingCash,
    countedCash: row.countedCash,
    expectedCash: row.expectedCash,
    difference: row.difference,
    totalCash: row.totalCash,
    totalTransfer: row.totalTransfer,
    totalCard: row.totalCard,
    totalOther: row.totalOther,
    totalSales: row.totalSales,
    salesCount: row.salesCount,
    cashOutTotal: row.cashOutTotal ?? 0,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private prisma: PrismaService,
    private catalog: PosCatalogService,
    private receiptsService: ReceiptsService,
    private notificationsService: NotificationsService,
    private cache: MemoryCacheService,
    private imageProcessing: ImageProcessingService,
  ) {}

  async searchCustomers(
    q: string,
    user: AuthenticatedUser,
  ): Promise<PosCustomerHintDto[]> {
    const term = q.trim();
    if (term.length < 3) return [];
    const where: Prisma.OrderWhereInput = {
      OR: [
        { customerName: { contains: term, mode: 'insensitive' } },
        { customerPhone: { contains: term, mode: 'insensitive' } },
      ],
      ...(user.role === Role.VENDEDOR_LOCAL
        ? { source: OrderSource.LOCAL }
        : {}),
    };
    const orders = await this.prisma.order.findMany({
      where,
      select: {
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerDocument: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    const seen = new Set<string>();
    const out: PosCustomerHintDto[] = [];
    for (const order of orders) {
      const phone = order.customerPhone?.trim();
      if (!phone) continue;
      const key = phone.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail || null,
        customerDocument: order.customerDocument,
      });
      if (out.length >= 10) break;
    }
    return out;
  }

  async uploadProof(file: Express.Multer.File): Promise<{ url: string }> {
    const base = this.imageProcessing.homepageFolder().replace(/\/homepage$/, '');
    const folder = `${base.replace(/\/$/, '')}/pos-proofs`;
    const url = await this.imageProcessing.uploadToCloudinary(
      file.buffer,
      `proof-${randomUUID()}`,
      folder,
    );
    return { url };
  }

  async findSaleByIdempotencyKey(key: string): Promise<PosSaleResultDto> {
    const found = await this.saleResultByKey(key);
    if (!found) throw new NotFoundException('Venta no encontrada');
    return found;
  }

  async createSale(
    dto: CreatePosSaleDto,
    user: AuthenticatedUser,
  ): Promise<PosSaleResultDto> {
    const started = Date.now();
    const mark = (step: string, t0 = started) => {
      this.logger.log(`createSale ${step} ${Date.now() - t0}ms`);
    };

    if (dto.idempotencyKey) {
      const existing = await this.saleResultByKey(dto.idempotencyKey);
      mark('idempotency-lookup');
      if (existing) {
        this.logger.log('createSale idempotent-hit');
        return existing;
      }
    }

    const watchIds = [...new Set(dto.items.map((item) => item.watchId))];
    const watches = await this.prisma.watch.findMany({
      where: { id: { in: watchIds }, deletedAt: null },
      select: {
        id: true,
        sku: true,
        model: true,
        reference: true,
        retailPrice: true,
        cost: true,
        stock: true,
        frontImageUrl: true,
        primaryImageUrl: true,
        images: true,
        brand: { select: { name: true } },
      },
    });
    mark('watches');
    if (watches.length !== watchIds.length) {
      throw new BadRequestException('Reloj no encontrado');
    }
    const watchById = new Map(watches.map((watch) => [watch.id, watch]));

    const grouped = new Map<
      string,
      { quantity: number; lineDiscount: number; unitPrice: number }
    >();
    let subtotal = 0;
    for (const item of dto.items) {
      const watch = watchById.get(item.watchId)!;
      const gross = watch.retailPrice * item.quantity;
      const lineDiscount = discountOrThrow(
        gross,
        item.discountAmount,
        item.discountPercent,
      );
      subtotal += gross;
      const prev = grouped.get(item.watchId) ?? {
        quantity: 0,
        lineDiscount: 0,
        unitPrice: watch.retailPrice,
      };
      grouped.set(item.watchId, {
        quantity: prev.quantity + item.quantity,
        lineDiscount: prev.lineDiscount + lineDiscount,
        unitPrice: watch.retailPrice,
      });
    }
    const lineDiscountTotal = [...grouped.values()].reduce(
      (sum, line) => sum + line.lineDiscount,
      0,
    );
    const afterLines = subtotal - lineDiscountTotal;
    const globalDiscount = discountOrThrow(
      afterLines,
      dto.discountAmount,
      dto.discountPercent,
    );
    const discountAmount = lineDiscountTotal + globalDiscount;
    const total = afterLines - globalDiscount;
    if (total < 0) {
      throw new BadRequestException('El total no puede ser negativo');
    }
    if (discountAmount > 0) {
      const reason = sanitizePlainText(dto.discountReason ?? '', 200);
      if (reason.length < 3) {
        throw new BadRequestException(
          'El motivo del descuento debe tener al menos 3 caracteres',
        );
      }
      dto.discountReason = reason;
    }
    mark('totals');

    const { normalized, changeTotal } = validatePosPayments(total, dto.payments);

    const customerName = sanitizePlainText(dto.customer.name, 120);
    const customerDocument = dto.customer.document
      ? sanitizePlainText(dto.customer.document, 30) || null
      : null;
    const customerPhone = dto.customer.phone?.trim() || null;
    const customerEmail = dto.customer.email?.trim() || null;
    const note = dto.note ? sanitizePlainText(dto.note, 300) || null : null;
    const discountReason =
      discountAmount > 0 ? (dto.discountReason ?? null) : null;

    const receiptConfig = await this.receiptsService.loadReceiptConfig();
    mark('receipt-config');

    const lines = [...grouped.entries()].map(([watchId, line]) => ({
      watchId,
      quantity: line.quantity,
    }));
    const itemRows = [...grouped.entries()].map(([watchId, line]) => {
      const watch = watchById.get(watchId)!;
      return {
        watchId: watch.id,
        productName: `${watch.brand.name} ${watch.model}`.trim(),
        productSku: watch.sku,
        productRef: watch.reference ?? watch.sku,
        productImage:
          watch.frontImageUrl ?? watch.primaryImageUrl ?? watch.images[0] ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.lineDiscount,
        unitCostSnapshot: watch.cost && watch.cost > 0 ? watch.cost : null,
        priceType: PriceType.RETAIL,
      };
    });

    let attempt = 0;
    let result: PosSaleResultDto;
    try {
      result = await withTxnRetries(async () => {
        attempt += 1;
        const txStarted = Date.now();
        this.logger.log(`createSale attempt ${attempt}`);
        const txResult = await this.prisma.$transaction(async (tx) => {
          await reserveWatchStock(tx, lines, {
            requireActive: true,
            message:
              'Stock insuficiente: otra venta se llevó este reloj. Actualiza el carrito.',
            inactiveMessage: 'Este reloj ya no está disponible',
          });
          const now = new Date();
          const readableId = await nextOrderReadableId(tx, now);
          const created = await tx.order.create({
            data: {
              readableId,
              stage: OrderStage.ORDER,
              status: OrderStatus.ENTREGADO,
              type: OrderType.DETAL,
              source: OrderSource.LOCAL,
              customerName,
              customerDocument,
              customerPhone,
              customerEmail,
              customerAddress: 'Venta en local',
              shippingCost: 0,
              depositExpected: 0,
              depositConfirmed: false,
              subtotal,
              discountAmount,
              discountReason,
              total,
              posIdempotencyKey: dto.idempotencyKey ?? null,
              paidAt: now,
              deliveredAt: now,
              sellerId: user.id,
              specialNote: note,
            },
            select: { id: true, readableId: true },
          });
          await tx.orderItem.createMany({
            data: itemRows.map((row) => ({ ...row, orderId: created.id })),
          });
          await tx.orderPayment.createMany({
            data: normalized.map((payment) => ({
              orderId: created.id,
              type: OrderPaymentType.SALDO,
              amount: payment.amount,
              paidAt: now,
              registeredById: user.id,
              method: payment.method as PaymentMethod,
              reference: payment.reference,
              proofUrl: payment.proofUrl,
              cardLast4: payment.cardLast4,
              cashReceived: payment.cashReceived,
              changeGiven: payment.changeGiven,
            })),
          });
          const receipt = await this.receiptsService.issueInTx(tx, created.id, {
            channel: 'LOCAL',
            saleDate: now,
            sellerId: user.id,
            config: receiptConfig,
          });
          return {
            orderId: created.id,
            readableId: created.readableId,
            receiptId: receipt.id,
            receiptNumber: receipt.number,
            total,
            changeTotal,
          };
        }, POS_SALE_TX);
        this.logger.log(
          `createSale tx-ok attempt ${attempt} ${Date.now() - txStarted}ms`,
        );
        return txResult;
      });
    } catch (error) {
      if (dto.idempotencyKey && isIdempotencyConflict(error)) {
        const existing = await this.saleResultByKey(dto.idempotencyKey);
        if (existing) return existing;
      }
      throw error;
    }
    mark(`done attempts=${attempt}`);

    this.cache.invalidateTag(CACHE_TAGS.catalog);
    await this.notificationsService.emit({
      type: 'POS_SALE',
      targetRole: Role.ADMIN,
      payload: {
        orderId: result.orderId,
        readableId: result.readableId,
        receiptNumber: result.receiptNumber,
        total: result.total,
      },
    });
    return result;
  }

  private async saleResultByKey(key: string): Promise<PosSaleResultDto | null> {
    const order = await this.prisma.order.findUnique({
      where: { posIdempotencyKey: key },
      select: {
        id: true,
        readableId: true,
        total: true,
        payments: { select: { changeGiven: true } },
        receipt: { select: { id: true, number: true } },
      },
    });
    if (!order?.receipt) return null;
    const changeTotal = order.payments.reduce(
      (sum, payment) => sum + (payment.changeGiven ?? 0),
      0,
    );
    return {
      orderId: order.id,
      readableId: order.readableId,
      receiptId: order.receipt.id,
      receiptNumber: order.receipt.number,
      total: order.total,
      changeTotal,
    };
  }

  async voidSale(
    orderId: string,
    rawReason: string,
    user: AuthenticatedUser,
  ): Promise<PosVoidSaleResultDto> {
    const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    const isSeller = user.role === Role.VENDEDOR_LOCAL;
    if (!isAdmin && !isSeller) {
      throw new ForbiddenException('No tienes permisos para esta acción');
    }
    const reason = sanitizePlainText(rawReason, 500);
    if (reason.length < 5) {
      throw new BadRequestException(
        'El motivo debe tener entre 5 y 500 caracteres',
      );
    }

    const result = await withTxnRetries(() =>
      this.prisma.$transaction(async (tx): Promise<PosVoidSaleResultDto> => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
        `;
        if (!locked.length) {
          throw new NotFoundException('Venta no encontrada');
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: { select: { watchId: true, quantity: true } },
            receipt: { select: { id: true, voidedAt: true } },
          },
        });
        if (!order) throw new NotFoundException('Venta no encontrada');
        if (order.stage !== OrderStage.ORDER) {
          throw new BadRequestException(
            'Solo se pueden anular ventas confirmadas',
          );
        }
        if (order.source !== OrderSource.LOCAL) {
          throw new BadRequestException(
            'Solo se pueden anular ventas del local',
          );
        }
        if (isSeller) {
          if (order.sellerId !== user.id) {
            throw new ForbiddenException(
              'Solo puedes anular tus propias ventas',
            );
          }
          const saleDay = todayBogotaYmd(order.paidAt ?? order.createdAt);
          if (saleDay !== todayBogotaYmd()) {
            throw new ForbiddenException(
              'Solo puedes anular ventas del día de hoy',
            );
          }
        }
        if (
          order.canceledAt ||
          order.status === OrderStatus.CANCELADO ||
          order.receipt?.voidedAt
        ) {
          throw new ConflictException('Esta venta ya fue anulada');
        }

        const businessDate = todayBogotaYmd(order.paidAt ?? order.createdAt);
        let afterCashClosing = false;
        if (order.sellerId) {
          const closing = await tx.cashClosing.findUnique({
            where: {
              businessDate_userId: {
                businessDate: new Date(`${businessDate}T00:00:00.000Z`),
                userId: order.sellerId,
              },
            },
            select: { id: true },
          });
          afterCashClosing = Boolean(closing);
        }

        const now = new Date();
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELADO, canceledAt: now },
        });
        await restoreWatchStock(
          tx,
          order.items.map((item) => ({
            watchId: item.watchId,
            quantity: item.quantity,
          })),
        );
        await this.receiptsService.voidForOrder(tx, order.id, reason);
        const receipt = await tx.saleReceipt.findUnique({
          where: { orderId: order.id },
          select: { voidedAt: true, voidReason: true },
        });

        return {
          orderId: order.id,
          readableId: order.readableId,
          status: 'CANCELADO',
          canceledAt: now.toISOString(),
          afterCashClosing,
          receipt: receipt
            ? {
                voidedAt: receipt.voidedAt?.toISOString() ?? null,
                voidReason: receipt.voidReason,
              }
            : null,
        };
      }, STOCK_TRANSACTION),
    );

    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return result;
  }

  private mySalesWhere(
    query: Pick<PosMySalesQueryDto, 'date' | 'sellerId'>,
    user: AuthenticatedUser,
  ): Prisma.OrderWhereInput {
    const date = query.date?.trim() || todayBogotaYmd();
    const { start, end } = bogotaDayRange(date);
    const where: Prisma.OrderWhereInput = {
      source: OrderSource.LOCAL,
      createdAt: { gte: start, lt: end },
      hiddenAt: null,
    };
    if (user.role === Role.VENDEDOR_LOCAL) {
      where.sellerId = user.id;
    } else if (query.sellerId) {
      where.sellerId = query.sellerId;
    }
    return where;
  }

  private isVoidedSale(order: {
    status: OrderStatus | null;
    receipt?: { voidedAt: Date | null } | null;
  }) {
    return order.status === OrderStatus.CANCELADO || Boolean(order.receipt?.voidedAt);
  }

  async hideSale(id: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        source: true,
        status: true,
        hiddenAt: true,
        receipt: { select: { voidedAt: true } },
      },
    });
    if (!order || order.source !== OrderSource.LOCAL) {
      throw new NotFoundException('Venta no encontrada');
    }
    if (!this.isVoidedSale(order)) {
      throw new BadRequestException('Solo se pueden eliminar ventas anuladas');
    }
    if (order.hiddenAt) {
      return {
        orderId: order.id,
        hiddenAt: order.hiddenAt.toISOString(),
        alreadyHidden: true,
      };
    }
    const hiddenAt = new Date();
    await this.prisma.order.update({
      where: { id: order.id },
      data: { hiddenAt, hiddenById: user.id },
    });
    return {
      orderId: order.id,
      hiddenAt: hiddenAt.toISOString(),
      alreadyHidden: false,
    };
  }

  async hideVoidedSales(
    query: Pick<PosMySalesQueryDto, 'date' | 'sellerId'>,
    user: AuthenticatedUser,
  ) {
    const result = await this.prisma.order.updateMany({
      where: {
        AND: [
          this.mySalesWhere(query, user),
          {
            OR: [
              { status: OrderStatus.CANCELADO },
              { receipt: { is: { voidedAt: { not: null } } } },
            ],
          },
        ],
      },
      data: { hiddenAt: new Date(), hiddenById: user.id },
    });
    return { hidden: result.count };
  }

  async mySales(
    query: PosMySalesQueryDto,
    user: AuthenticatedUser,
  ): Promise<{
    items: PosMySaleDto[];
    total: number;
    voidedCount: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = this.mySalesWhere(query, user);
    const voidedWhere: Prisma.OrderWhereInput = {
      AND: [
        where,
        {
          OR: [
            { status: OrderStatus.CANCELADO },
            { receipt: { is: { voidedAt: { not: null } } } },
          ],
        },
      ],
    };

    const [total, voidedCount, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: voidedWhere }),
      this.prisma.order.findMany({
        where,
        include: {
          payments: { select: { method: true } },
          receipt: {
            select: {
              id: true,
              number: true,
              voidedAt: true,
              voidReason: true,
            },
          },
          seller: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: orders.map((order) => ({
        id: order.id,
        readableId: order.readableId,
        createdAt: order.createdAt.toISOString(),
        customerName: order.customerName,
        total: order.total,
        discountAmount: order.discountAmount,
        discountReason: order.discountReason,
        sellerId: order.sellerId,
        methods: order.payments
          .map((p) => p.method)
          .filter((m): m is PaymentMethod => !!m),
        receiptId: order.receipt?.id ?? null,
        receiptNumber: order.receipt?.number ?? null,
        receiptVoided: Boolean(order.receipt?.voidedAt),
        receipt: order.receipt
          ? {
              voidedAt: order.receipt.voidedAt?.toISOString() ?? null,
              voidReason: order.receipt.voidReason,
            }
          : null,
        status: order.status,
        sellerName: order.seller?.name ?? null,
      })),
      total,
      voidedCount,
      page,
      limit,
    };
  }

  private assertCashDateAllowed(date: string, role: string) {
    if (role !== Role.VENDEDOR_LOCAL) return;
    const today = todayBogotaYmd();
    const yesterdayParts = bogotaDayRange(today);
    const yest = new Date(yesterdayParts.start.getTime() - 24 * 60 * 60 * 1000);
    const ymd = todayBogotaYmd(yest);
    if (date !== today && date !== ymd) {
      throw new ForbiddenException(
        'Solo puedes consultar el cierre de hoy o de ayer',
      );
    }
  }

  async cashClosingPreview(
    dateInput: string | undefined,
    user: AuthenticatedUser,
  ): Promise<PosCashClosingPreviewDto> {
    const date = dateInput?.trim() || todayBogotaYmd();
    this.assertCashDateAllowed(date, user.role);
    const totals = await this.computeCashTotals(date, user.id);
    const existing = await this.prisma.cashClosing.findUnique({
      where: {
        businessDate_userId: {
          businessDate: new Date(`${date}T00:00:00.000Z`),
          userId: user.id,
        },
      },
      include: { user: { select: { name: true } } },
    });
    return {
      date,
      ...totals,
      alreadyClosed: !!existing,
      closing: existing ? toClosingDto(existing) : null,
    };
  }

  /**
   * Ventas anuladas después de un cierre no modifican el CashClosing guardado.
   */
  async createCashClosing(
    dto: CreateCashClosingDto,
    user: AuthenticatedUser,
  ): Promise<PosCashClosingDto> {
    const date = dto.date.trim();
    this.assertCashDateAllowed(date, user.role);
    const totals = await this.computeCashTotals(date, user.id);
    const expectedCash = expectedDrawerCash(
      dto.openingCash,
      totals.totalCash,
      totals.cashOutTotal,
    );
    const difference = dto.countedCash - expectedCash;
    const notes = dto.notes ? sanitizePlainText(dto.notes, 500) || null : null;
    if (!cashClosingNoteValid(difference, notes)) {
      throw new BadRequestException('Explica por qué sobra o falta dinero');
    }
    const businessDate = new Date(`${date}T00:00:00.000Z`);

    try {
      const created = await this.prisma.cashClosing.create({
        data: {
          businessDate,
          userId: user.id,
          openingCash: dto.openingCash,
          countedCash: dto.countedCash,
          expectedCash,
          difference,
          totalCash: totals.totalCash,
          totalTransfer: totals.totalTransfer,
          totalCard: totals.totalCard,
          totalOther: totals.totalOther,
          totalSales: totals.totalSales,
          salesCount: totals.salesCount,
          cashOutTotal: totals.cashOutTotal,
          notes,
        },
        include: { user: { select: { name: true } } },
      });
      return toClosingDto(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya registraste el cierre de caja de este día',
        );
      }
      throw error;
    }
  }

  async listCashClosings(
    from?: string,
    to?: string,
    page = 1,
    limit = 15,
  ): Promise<PosCashClosingsPageDto> {
    const where: Prisma.CashClosingWhereInput = {};
    if (from || to) {
      where.businessDate = {
        ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
        ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
      };
    }
    return this.pageClosings(where, page, limit);
  }

  async myCashClosings(
    userId: string,
    page = 1,
    limit = 15,
  ): Promise<PosCashClosingsPageDto> {
    return this.pageClosings({ userId }, page, limit);
  }

  private async pageClosings(
    where: Prisma.CashClosingWhereInput,
    page: number,
    limit: number,
  ): Promise<PosCashClosingsPageDto> {
    const take = Math.min(50, Math.max(1, limit));
    const current = Math.max(1, page);
    const [total, rows] = await Promise.all([
      this.prisma.cashClosing.count({ where }),
      this.prisma.cashClosing.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
        skip: (current - 1) * take,
        take,
      }),
    ]);
    return {
      items: rows.map(toClosingDto),
      total,
      page: current,
      limit: take,
    };
  }

  async createCashOut(dto: CreateCashOutDto, user: AuthenticatedUser) {
    const date = dto.date.trim();
    this.assertCashDateAllowed(date, user.role);
    const name = sanitizePlainText(dto.name, 120);
    if (!name) throw new BadRequestException('El concepto es obligatorio');
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('El valor debe ser mayor a 0');
    }
    const description = sanitizePlainText(dto.notes ?? '', 500) || null;
    const created = await this.prisma.expense.create({
      data: {
        name,
        description,
        amount: dto.amount,
        spentAt: expenseDate(date),
        origin: 'LOCAL',
        paidWithCash: true,
        createdById: user.id,
      },
      include: { createdBy: { select: { name: true } } },
    });
    return {
      id: created.id,
      name: created.name,
      description: created.description,
      amount: created.amount,
      spentAt: created.spentAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      createdByName: created.createdBy?.name ?? null,
    };
  }

  async cashClosingPdf(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.cashClosing.findUnique({
      where: { id },
      include: { user: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('Cierre no encontrado');
    if (user.role === Role.VENDEDOR_LOCAL && row.userId !== user.id) {
      throw new ForbiddenException();
    }
    const dto = toClosingDto(row);
    const buffer = await renderCashClosingPdf(dto);
    return {
      filename: `Cierre-caja-${dto.businessDate}.pdf`,
      buffer,
    };
  }

  async computeCashTotals(date: string, userId: string) {
    const { start, end } = bogotaDayRange(date);
    const payments = await this.prisma.orderPayment.findMany({
      where: {
        registeredById: userId,
        paidAt: { gte: start, lt: end },
        order: { source: OrderSource.LOCAL },
      },
      select: {
        amount: true,
        method: true,
        paidAt: true,
        order: {
          select: {
            id: true,
            readableId: true,
            customerName: true,
            total: true,
            canceledAt: true,
            receipt: { select: { number: true } },
            items: {
              select: { productName: true, productImage: true },
            },
          },
        },
      },
    });

    let totalCash = 0;
    let totalTransfer = 0;
    let totalCard = 0;
    let totalOther = 0;
    const activeOrders = new Set<string>();
    const buckets: Record<'cash' | 'transfer' | 'card', Map<string, PosCashSaleLineDto>> = {
      cash: new Map(),
      transfer: new Map(),
      card: new Map(),
    };
    const voided = new Map<string, PosCashSaleLineDto>();

    for (const payment of payments) {
      const order = payment.order;
      const method = payment.method ?? '';
      const watches = (order.items ?? []).map((item) => ({
        name: item.productName,
        imageUrl: item.productImage ?? null,
      }));
      if (order.canceledAt) {
        const existing = voided.get(order.id);
        if (existing) {
          existing.portion += payment.amount;
          if (payment.paidAt.toISOString() < existing.paidAt) {
            existing.paidAt = payment.paidAt.toISOString();
          }
        } else {
          voided.set(order.id, {
            orderId: order.id,
            readableId: order.readableId,
            receiptNumber: order.receipt?.number ?? null,
            paidAt: payment.paidAt.toISOString(),
            customerName: order.customerName,
            total: order.total,
            portion: payment.amount,
            method,
            watches,
          });
        }
        continue;
      }

      activeOrders.add(order.id);
      if (method === PaymentMethod.EFECTIVO) totalCash += payment.amount;
      else if (method === PaymentMethod.TRANSFERENCIA)
        totalTransfer += payment.amount;
      else if (method === PaymentMethod.DATAFONO_BOLD)
        totalCard += payment.amount;
      else totalOther += payment.amount;

      const bucket =
        method === PaymentMethod.EFECTIVO
          ? buckets.cash
          : method === PaymentMethod.TRANSFERENCIA
            ? buckets.transfer
            : method === PaymentMethod.DATAFONO_BOLD
              ? buckets.card
              : null;
      if (!bucket) continue;
      const key = order.id;
      const existing = bucket.get(key);
      if (existing) {
        existing.portion += payment.amount;
      } else {
        bucket.set(key, {
          orderId: order.id,
          readableId: order.readableId,
          receiptNumber: order.receipt?.number ?? null,
          paidAt: payment.paidAt.toISOString(),
          customerName: order.customerName,
          total: order.total,
          portion: payment.amount,
          method,
          watches,
        });
      }
    }

    const sortLines = (rows: PosCashSaleLineDto[]) =>
      rows.sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));

    const day = expenseDate(date);
    const cashOutRows = this.prisma.expense?.findMany
      ? await this.prisma.expense.findMany({
          where: {
            origin: 'LOCAL',
            paidWithCash: true,
            spentAt: {
              gte: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0)),
              lte: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59, 999)),
            },
          },
          include: { createdBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const cashOuts: PosCashOutDto[] = cashOutRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      amount: row.amount,
      spentAt: row.spentAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      createdByName: row.createdBy?.name ?? null,
    }));
    const cashOutTotal = cashOuts.reduce((sum, row) => sum + row.amount, 0);

    const totalSales = totalCash + totalTransfer + totalCard + totalOther;
    return {
      totalCash,
      totalTransfer,
      totalCard,
      totalOther,
      totalSales,
      salesCount: activeOrders.size,
      cashOutTotal,
      cashOuts,
      salesByMethod: {
        cash: sortLines([...buckets.cash.values()]),
        transfer: sortLines([...buckets.transfer.values()]),
        card: sortLines([...buckets.card.values()]),
      },
      voidedSales: sortLines([...voided.values()]),
    };
  }
}
