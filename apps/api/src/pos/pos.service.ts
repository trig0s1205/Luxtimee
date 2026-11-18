import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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
import type {
  PosCashClosingDto,
  PosCashClosingPreviewDto,
  PosCustomerHintDto,
  PosMySaleDto,
  PosSaleResultDto,
} from '@luxtime/shared';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  reserveWatchStock,
  STOCK_TRANSACTION,
} from '../common/utils/watch-stock.tx';
import { sanitizePlainText } from '../common/utils/sanitize-text.util';
import { ImageProcessingService } from '../integrations/image-processing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { nextOrderReadableId } from '../common/utils/document-counter.util';
import { withTxnRetries } from '../common/utils/txn-retries.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  bogotaDayRange,
  todayBogotaYmd,
} from '../receipts/bogota-time.util';
import { validatePosPayments } from '../receipts/payments.util';
import { ReceiptsService } from '../receipts/receipts.service';
import {
  CreateCashClosingDto,
  CreatePosSaleDto,
  PosMySalesQueryDto,
} from './dto/pos.dto';
import { PosCatalogService } from './pos-catalog.service';

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
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class PosService {
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

  async createSale(
    dto: CreatePosSaleDto,
    user: AuthenticatedUser,
  ): Promise<PosSaleResultDto> {
    const qtyByWatch = new Map<string, number>();
    for (const item of dto.items) {
      qtyByWatch.set(
        item.watchId,
        (qtyByWatch.get(item.watchId) ?? 0) + item.quantity,
      );
    }
    const lines = [...qtyByWatch.entries()].map(([watchId, quantity]) => ({
      watchId,
      quantity,
    }));

    const watches = await this.prisma.watch.findMany({
      where: {
        id: { in: lines.map((line) => line.watchId) },
        deletedAt: null,
      },
      select: {
        id: true,
        sku: true,
        model: true,
        reference: true,
        retailPrice: true,
        stock: true,
        frontImageUrl: true,
        primaryImageUrl: true,
        images: true,
        brand: { select: { name: true } },
      },
    });
    if (watches.length !== lines.length) {
      throw new BadRequestException('Reloj no encontrado');
    }
    const watchById = new Map(watches.map((watch) => [watch.id, watch]));

    let subtotal = 0;
    const itemCreates = lines.map((line) => {
      const watch = watchById.get(line.watchId)!;
      const unitPrice = watch.retailPrice;
      subtotal += unitPrice * line.quantity;
      return {
        watchId: watch.id,
        productName: `${watch.brand.name} ${watch.model}`.trim(),
        productSku: watch.sku,
        productRef: watch.reference ?? watch.sku,
        productImage:
          watch.frontImageUrl ?? watch.primaryImageUrl ?? watch.images[0] ?? null,
        quantity: line.quantity,
        unitPrice,
        priceType: PriceType.RETAIL,
      };
    });
    const total = subtotal;

    const { normalized, changeTotal } = validatePosPayments(total, dto.payments);

    const customerName = sanitizePlainText(dto.customer.name, 120);
    const customerDocument = dto.customer.document
      ? sanitizePlainText(dto.customer.document, 30) || null
      : null;
    const customerPhone = dto.customer.phone?.trim() || null;
    const customerEmail = dto.customer.email?.trim() || '';
    const note = dto.note
      ? sanitizePlainText(dto.note, 300) || null
      : null;

    const result = await withTxnRetries(async () => {
      const now = new Date();
      return this.prisma.$transaction(async (tx) => {
        await reserveWatchStock(
          tx,
          lines.map((line) => ({
            watchId: line.watchId,
            quantity: line.quantity,
          })),
          {
            requireActive: true,
            message:
              'Stock insuficiente: otra venta se llevó este reloj. Actualiza el carrito.',
            inactiveMessage: 'Este reloj ya no está disponible',
          },
        );

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
            total,
            paidAt: now,
            deliveredAt: now,
            sellerId: user.id,
            specialNote: note,
            items: { create: itemCreates },
            payments: {
              create: normalized.map((payment) => ({
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
            },
          },
          select: { id: true, readableId: true },
        });

        const receipt = await this.receiptsService.issueInTx(tx, created.id, {
          channel: 'LOCAL',
          saleDate: now,
          sellerId: user.id,
        });

        return {
          orderId: created.id,
          readableId: created.readableId,
          receiptId: receipt.id,
          receiptNumber: receipt.number,
          total,
          changeTotal,
        };
      }, STOCK_TRANSACTION);
    });

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

  async mySales(
    query: PosMySalesQueryDto,
    user: AuthenticatedUser,
  ): Promise<{ items: PosMySaleDto[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const date = query.date?.trim() || todayBogotaYmd();
    const { start, end } = bogotaDayRange(date);

    const where: Prisma.OrderWhereInput = {
      source: OrderSource.LOCAL,
      createdAt: { gte: start, lt: end },
    };
    if (user.role === Role.VENDEDOR_LOCAL) {
      where.sellerId = user.id;
    } else if (query.sellerId) {
      where.sellerId = query.sellerId;
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          payments: { select: { method: true } },
          receipt: { select: { id: true, number: true, voidedAt: true } },
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
        methods: order.payments
          .map((p) => p.method)
          .filter((m): m is PaymentMethod => !!m),
        receiptId: order.receipt?.id ?? null,
        receiptNumber: order.receipt?.number ?? null,
        receiptVoided: Boolean(order.receipt?.voidedAt),
        status: order.status,
        sellerName: order.seller?.name ?? null,
      })),
      total,
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
    const expectedCash = dto.openingCash + totals.totalCash;
    const difference = dto.countedCash - expectedCash;
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
          notes: dto.notes ? sanitizePlainText(dto.notes, 500) || null : null,
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

  async listCashClosings(from?: string, to?: string): Promise<PosCashClosingDto[]> {
    const where: Prisma.CashClosingWhereInput = {};
    if (from || to) {
      where.businessDate = {
        ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
        ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
      };
    }
    const rows = await this.prisma.cashClosing.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return rows.map(toClosingDto);
  }

  async myCashClosings(userId: string): Promise<PosCashClosingDto[]> {
    const rows = await this.prisma.cashClosing.findMany({
      where: { userId },
      include: { user: { select: { name: true } } },
      orderBy: { businessDate: 'desc' },
      take: 30,
    });
    return rows.map(toClosingDto);
  }

  async computeCashTotals(date: string, userId: string) {
    const { start, end } = bogotaDayRange(date);
    const payments = await this.prisma.orderPayment.findMany({
      where: {
        registeredById: userId,
        paidAt: { gte: start, lt: end },
        order: {
          source: OrderSource.LOCAL,
          canceledAt: null,
        },
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
          },
        },
      },
    });

    let totalCash = 0;
    let totalTransfer = 0;
    let totalCard = 0;
    let totalOther = 0;
    const salesMap = new Map<
      string,
      {
        readableId: string;
        paidAt: string;
        customerName: string;
        total: number;
        methods: string[];
      }
    >();

    for (const payment of payments) {
      const method = payment.method;
      if (method === PaymentMethod.EFECTIVO) totalCash += payment.amount;
      else if (method === PaymentMethod.TRANSFERENCIA)
        totalTransfer += payment.amount;
      else if (method === PaymentMethod.DATAFONO_BOLD)
        totalCard += payment.amount;
      else totalOther += payment.amount;

      const existing = salesMap.get(payment.order.id);
      if (existing) {
        if (method && !existing.methods.includes(method)) {
          existing.methods.push(method);
        }
      } else {
        salesMap.set(payment.order.id, {
          readableId: payment.order.readableId,
          paidAt: payment.paidAt.toISOString(),
          customerName: payment.order.customerName,
          total: payment.order.total,
          methods: method ? [method] : [],
        });
      }
    }

    const sales = [...salesMap.values()].sort((a, b) =>
      a.paidAt < b.paidAt ? 1 : -1,
    );
    const totalSales = totalCash + totalTransfer + totalCard + totalOther;
    return {
      totalCash,
      totalTransfer,
      totalCard,
      totalOther,
      totalSales,
      salesCount: sales.length,
      sales,
    };
  }
}
