import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PrismaClient,
  Role,
  WatchStatus,
} from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { acquireDbSuiteLock } from '../common/test/db-suite-lock';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrdersService } from '../orders/orders.service';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PosCatalogService } from './pos-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptPdfRenderer } from '../receipts/receipt-pdf.renderer';
import { ReceiptsService } from '../receipts/receipts.service';
import { todayBogotaYmd } from '../receipts/bogota-time.util';
import { SettingsService } from '../settings/settings.service';

jest.setTimeout(90_000);

const rawDbUrl = process.env.DATABASE_URL ?? '';
const isLocalhost = /localhost|127\.0\.0\.1/.test(rawDbUrl);
const describeLocal = isLocalhost ? describe : describe.skip;

const PRICE = 100_000;
const REASON = 'Cliente devolvió el reloj';

function httpContext(role: Role): ExecutionContext {
  return {
    getHandler: () => PosController.prototype.voidSale,
    getClass: () => PosController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { role, id: 'u' } }),
    }),
  } as unknown as ExecutionContext;
}

function closingSnapshot(row: {
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
}) {
  return {
    ...row,
    businessDate: row.businessDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

describeLocal('POS void sale (localhost DB)', () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  const prefix = `pvoid${Date.now().toString(36)}`;
  let releaseLock: (() => void) | undefined;

  const skuSale = `QA-${prefix}-SALE`.toUpperCase();
  const skuWeb = `QA-${prefix}-WEB`.toUpperCase();

  let brandId = '';
  let sellerId = '';
  let adminId = '';
  const watchIds: string[] = [];
  const orderIds: string[] = [];

  let pos: PosService;
  let orders: OrdersService;
  let cache: MemoryCacheService;

  const sellerUser = () => ({
    id: sellerId,
    email: `${prefix}-seller@pos.local`,
    name: 'Vendedor QA',
    role: Role.VENDEDOR_LOCAL,
  });
  const adminUser = () => ({
    id: adminId,
    email: `${prefix}-admin@pos.local`,
    name: 'Admin QA',
    role: Role.ADMIN,
  });

  beforeAll(async () => {
    releaseLock = await acquireDbSuiteLock();
    await prisma.$connect();
    cache = new MemoryCacheService();
    const settings = new SettingsService(db, cache, {} as never);
    const receipts = new ReceiptsService(db, settings, new ReceiptPdfRenderer());
    const notifications = { emit: async () => ({ id: 'n' }) } as never;
    pos = new PosService(
      db,
      new PosCatalogService(db),
      receipts,
      notifications,
      cache,
      {} as never,
    );
    orders = new OrdersService(
      db,
      notifications,
      { generateForOrder: async () => [] } as never,
      cache,
      { notifyOrder: async () => ({ emailed: false, whatsappUrl: null }) } as never,
      receipts,
    );

    const brand = await prisma.brand.create({
      data: { name: `QA Void ${prefix}`, slug: `qa-void-${prefix}` },
    });
    brandId = brand.id;
    const seller = await prisma.user.create({
      data: {
        email: `${prefix}-seller@pos.local`,
        name: 'Vendedor QA',
        role: Role.VENDEDOR_LOCAL,
      },
    });
    sellerId = seller.id;
    const admin = await prisma.user.create({
      data: {
        email: `${prefix}-admin@pos.local`,
        name: 'Admin QA',
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;

    for (const sku of [skuSale, skuWeb]) {
      const watch = await prisma.watch.create({
        data: {
          sku,
          slug: sku.toLowerCase(),
          model: `Modelo ${sku}`,
          reference: sku,
          retailPrice: PRICE,
          wholesalePrice: 80_000,
          cost: 40_000,
          stock: sku === skuSale ? 5 : 2,
          status: WatchStatus.DISPONIBLE,
          isActive: true,
          isPublished: true,
          warrantyMonths: 12,
          movementType: 'Quartz',
          frontImageUrl: `https://cdn.example/${sku}.jpg`,
          images: [`https://cdn.example/${sku}.jpg`],
          brandId,
        },
      });
      watchIds.push(watch.id);
    }
  });

  afterAll(async () => {
    try {
      const sellers = [sellerId, adminId].filter(Boolean);
      const ordersToDrop = orderIds.length
        ? orderIds
        : (
            await prisma.order.findMany({
              where: { sellerId: { in: sellers } },
              select: { id: true },
            })
          ).map((row) => row.id);
      if (ordersToDrop.length) {
        await prisma.saleReceiptPdf.deleteMany({
          where: { receipt: { orderId: { in: ordersToDrop } } },
        });
        await prisma.saleReceiptItem.deleteMany({
          where: { receipt: { orderId: { in: ordersToDrop } } },
        });
        await prisma.saleReceipt.deleteMany({
          where: { orderId: { in: ordersToDrop } },
        });
        await prisma.orderPayment.deleteMany({
          where: { orderId: { in: ordersToDrop } },
        });
        await prisma.orderItem.deleteMany({
          where: { orderId: { in: ordersToDrop } },
        });
        await prisma.order.deleteMany({ where: { id: { in: ordersToDrop } } });
      }
      if (sellers.length) {
        await prisma.cashClosing.deleteMany({ where: { userId: { in: sellers } } });
        await prisma.user.deleteMany({ where: { id: { in: sellers } } });
      }
      if (watchIds.length) {
        await prisma.watch.deleteMany({ where: { id: { in: watchIds } } });
      }
      if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
    } finally {
      await prisma.$disconnect().catch(() => undefined);
      releaseLock?.();
      releaseLock = undefined;
    }
  });

  function saleWatch() {
    return prisma.watch.findUniqueOrThrow({ where: { sku: skuSale } });
  }

  async function sell(customerName: string) {
    const watch = await saleWatch();
    const sale = await pos.createSale(
      {
        customer: { name: customerName },
        items: [{ watchId: watch.id, quantity: 1 }],
        payments: [{ method: 'TRANSFERENCIA', amount: PRICE }],
      },
      sellerUser(),
    );
    orderIds.push(sale.orderId);
    return sale;
  }

  it('anula la venta local, repone stock, invalida catálogo y publica el motivo', async () => {
    const before = await saleWatch();
    const sale = await sell(`Anular ${prefix}`);
    expect((await saleWatch()).stock).toBe(before.stock - 1);

    cache.set('void-catalog', { ok: true }, 60_000, CACHE_TAGS.catalog);
    const voided = await pos.voidSale(sale.orderId, `  ${REASON}  `, adminUser());

    expect(cache.get('void-catalog')).toBeUndefined();
    expect(voided.afterCashClosing).toBe(false);
    expect(voided.status).toBe('CANCELADO');
    expect(voided.receipt).toMatchObject({ voidReason: REASON });
    expect(voided.receipt?.voidedAt).toEqual(expect.any(String));
    expect((await saleWatch()).stock).toBe(before.stock);

    const row = await prisma.order.findUniqueOrThrow({ where: { id: sale.orderId } });
    expect(row.status).toBe(OrderStatus.CANCELADO);
    expect(row.canceledAt).not.toBeNull();

    const receipt = await prisma.saleReceipt.findUniqueOrThrow({
      where: { orderId: sale.orderId },
    });
    expect(receipt.voidedAt).not.toBeNull();
    expect(receipt.voidReason).toBe(REASON);

    await expect(
      pos.voidSale(sale.orderId, 'Segundo intento de anulación', adminUser()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await saleWatch()).stock).toBe(before.stock);

    const mine = await pos.mySales({ date: todayBogotaYmd() }, adminUser());
    expect(mine.items.find((item) => item.id === sale.orderId)?.receipt).toEqual({
      voidedAt: receipt.voidedAt?.toISOString() ?? null,
      voidReason: REASON,
    });

    const listed = await orders.findAllOrders({
      source: OrderSource.LOCAL,
      type: OrderType.DETAL,
      period: 'all',
      search: `Anular ${prefix}`,
      limit: 20,
    });
    expect(listed.items.find((item) => item.id === sale.orderId)?.receipt).toEqual({
      voidedAt: receipt.voidedAt?.toISOString() ?? null,
      voidReason: REASON,
    });
  });

  it('otro vendedor recibe 403 y la venta sigue vigente', async () => {
    const sale = await sell(`Prohibido ${prefix}`);
    const stock = (await saleWatch()).stock;
    await expect(
      pos.voidSale(sale.orderId, REASON, {
        ...sellerUser(),
        id: 'otro-vendedor',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: sale.orderId } });
    expect(row.status).toBe(OrderStatus.ENTREGADO);
    expect(row.canceledAt).toBeNull();
    expect((await saleWatch()).stock).toBe(stock);
    const receipt = await prisma.saleReceipt.findUniqueOrThrow({
      where: { orderId: sale.orderId },
    });
    expect(receipt.voidedAt).toBeNull();

    const guard = new RolesGuard(new Reflector());
    expect(guard.canActivate(httpContext(Role.VENDEDOR_LOCAL))).toBe(true);
  });

  it('rechaza un pedido que no es del local', async () => {
    const watch = await prisma.watch.findUniqueOrThrow({ where: { sku: skuWeb } });
    const created = await prisma.order.create({
      data: {
        readableId: `LX-${prefix}-WEB`.slice(0, 24),
        stage: 'ORDER',
        status: OrderStatus.ENTREGADO,
        type: OrderType.DETAL,
        source: OrderSource.WEB,
        customerName: `Web ${prefix}`,
        customerAddress: 'Calle 1',
        customerEmail: `${prefix}-web@pos.local`,
        sellerId,
        subtotal: PRICE,
        total: PRICE,
        items: {
          create: {
            watchId: watch.id,
            productName: 'Web',
            productSku: skuWeb,
            productRef: skuWeb,
            quantity: 1,
            unitPrice: PRICE,
            priceType: 'RETAIL',
          },
        },
      },
    });
    orderIds.push(created.id);
    await expect(pos.voidSale(created.id, REASON, adminUser())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const row = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe(OrderStatus.ENTREGADO);
    expect(row.canceledAt).toBeNull();
    expect((await prisma.watch.findUniqueOrThrow({ where: { id: watch.id } })).stock).toBe(2);
  });

  it('detecta un cierre de caja ya guardado y no lo modifica', async () => {
    const sale = await sell(`Cierre ${prefix}`);
    const date = todayBogotaYmd();
    await pos.createCashClosing(
      { date, openingCash: 10_000, countedCash: 10_000, notes: `Cierre ${prefix}` },
      sellerUser(),
    );
    const businessDate = new Date(`${date}T00:00:00.000Z`);
    const before = await prisma.cashClosing.findUniqueOrThrow({
      where: { businessDate_userId: { businessDate, userId: sellerId } },
    });
    const beforeSnap = closingSnapshot(before);

    const voided = await pos.voidSale(sale.orderId, REASON, adminUser());
    expect(voided.afterCashClosing).toBe(true);

    const after = await prisma.cashClosing.findUniqueOrThrow({
      where: { businessDate_userId: { businessDate, userId: sellerId } },
    });
    expect(closingSnapshot(after)).toEqual(beforeSnap);
    expect(
      await prisma.cashClosing.count({
        where: { businessDate, userId: sellerId },
      }),
    ).toBe(1);
    const payments = await prisma.orderPayment.findMany({
      where: { orderId: sale.orderId },
      select: { method: true },
    });
    expect(payments.map((payment) => payment.method)).toContain(PaymentMethod.TRANSFERENCIA);
  });
});
