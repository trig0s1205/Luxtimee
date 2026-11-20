import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import {
  OrderStatus,
  PaymentMethod,
  PrismaClient,
  Role,
  WatchStatus,
  WarrantyClaimStatus,
} from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { hashPassword } from '../auth/password.util';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { acquireDbSuiteLock } from '../common/test/db-suite-lock';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';
import { CatalogService } from '../catalog/catalog.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import { ExpensesService } from '../expenses/expenses.service';
import { InventoryService } from '../inventory/inventory.service';
import { WhatsappService } from '../integrations/whatsapp.service';
import { LabelsService } from '../labels/labels.service';
import { LabelPdfRenderer } from '../labels/label-pdf.renderer';
import { OrdersService } from '../orders/orders.service';
import { PosCatalogService } from './pos-catalog.service';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PreOrdersService } from '../pre-orders/pre-orders.service';
import { ReceiptPdfRenderer } from '../receipts/receipt-pdf.renderer';
import { ReceiptsService } from '../receipts/receipts.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ExpensesController } from '../expenses/expenses.controller';
import { LabelsController } from '../labels/labels.controller';
import { WatchesController } from '../watches/watches.controller';
import { DashboardsController } from '../dashboards/dashboards.controller';
import { WarrantyClaimsService } from '../warranty-claims/warranty-claims.service';

jest.setTimeout(90_000);

const rawDbUrl = process.env.DATABASE_URL ?? '';
const isLocalhost = /localhost|127\.0\.0\.1/.test(rawDbUrl);
const describeLocal = isLocalhost ? describe : describe.skip;

const PRICE = 100_000;
const SELLER_PASSWORD = 'vendedor-local-qa';
const ADMIN_PASSWORD = 'admin-local-qa-1';

function httpContext(
  role: Role,
  handler: (...args: never[]) => unknown,
  controller: new (...args: never[]) => unknown,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ user: { role, id: 'u' } }),
    }),
  } as unknown as ExecutionContext;
}

function pdfLiteralText(buffer: Buffer) {
  const raw = buffer.toString('latin1');
  return [...raw.matchAll(/<([0-9A-Fa-f]+)>/g)]
    .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
    .join('');
}

describeLocal('POS flow (localhost DB)', () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  const prefix = `pflow${Date.now().toString(36)}`;
  let releaseLock: (() => void) | undefined;

  const skuCash = `QA-${prefix}-CASH`.toUpperCase();
  const skuScan = `QA-${prefix}-SCAN`.toUpperCase();
  const skuLast = `QA-${prefix}-LAST`.toUpperCase();
  const skuSpecial = `QA-${prefix}-ESP`.toUpperCase();
  const skuCancel = `QA-${prefix}-VOID`.toUpperCase();
  const skuWeb = `QA-${prefix}-WEB`.toUpperCase();

  let brandId = '';
  let categoryId = '';
  let sellerId = '';
  let adminId = '';
  const watchIds: string[] = [];
  const orderIds: string[] = [];
  const expenseIds: string[] = [];

  let pos: PosService;
  let catalogPos: PosCatalogService;
  let receipts: ReceiptsService;
  let orders: OrdersService;
  let expenses: ExpensesService;
  let labels: LabelsService;
  let claims: WarrantyClaimsService;
  let cache: MemoryCacheService;
  let dashboards: DashboardsService;
  let storeCatalog: CatalogService;
  let inventory: InventoryService;
  let preOrders: PreOrdersService;
  let auth: AuthService;
  const pdf = new ReceiptPdfRenderer();

  const sellerUser = () =>
    ({
      id: sellerId,
      email: `${prefix}-seller@pos.local`,
      name: 'Vendedor QA',
      role: Role.VENDEDOR_LOCAL,
    });

  beforeAll(async () => {
    releaseLock = await acquireDbSuiteLock();
    await prisma.$connect();
    cache = new MemoryCacheService();
    const settings = new SettingsService(db, cache, {} as never);
    receipts = new ReceiptsService(db, settings, pdf);
    const notifications = { emit: async () => ({ id: 'n' }) } as never;
    catalogPos = new PosCatalogService(db);
    pos = new PosService(
      db,
      catalogPos,
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
    expenses = new ExpensesService(db);
    labels = new LabelsService(db, new LabelPdfRenderer());
    claims = new WarrantyClaimsService(db, cache);
    preOrders = new PreOrdersService(
      db,
      notifications,
      settings,
      new WhatsappService({ get: () => undefined } as unknown as ConfigService),
      {} as never,
      {} as never,
      { notifyOrder: async () => ({ emailed: false, whatsappUrl: null }) } as never,
      cache,
    );
    dashboards = new DashboardsService(db, settings, {} as never);
    storeCatalog = new CatalogService(db);
    inventory = new InventoryService(
      db,
      { notifyBackInStock: async () => undefined } as never,
      cache,
    );
    auth = new AuthService(
      db,
      {} as JwtService,
      {
        get: (key: string) => {
          if (key === 'JWT_SECRET') return 'qa-jwt-secret-local-only';
          if (key === 'JWT_REFRESH_SECRET') return 'qa-refresh-secret-local';
          if (key === 'NODE_ENV') return 'test';
          return undefined;
        },
      } as ConfigService,
    );

    const brand = await prisma.brand.create({
      data: { name: `QA POS ${prefix}`, slug: `qa-pos-${prefix}` },
    });
    brandId = brand.id;
    const category = await prisma.category.create({
      data: { name: `QA Cat ${prefix}`, slug: `qa-cat-${prefix}` },
    });
    categoryId = category.id;
    const seller = await prisma.user.create({
      data: {
        email: `${prefix}-seller@pos.local`,
        name: 'Vendedor QA',
        role: Role.VENDEDOR_LOCAL,
        passwordHash: hashPassword(SELLER_PASSWORD),
      },
    });
    sellerId = seller.id;
    const admin = await prisma.user.create({
      data: {
        email: `${prefix}-admin@pos.local`,
        name: 'Admin QA',
        role: Role.ADMIN,
        passwordHash: hashPassword(ADMIN_PASSWORD),
      },
    });
    adminId = admin.id;

    async function watch(input: {
      sku: string;
      stock: number;
      warrantyMonths: number;
      published?: boolean;
    }) {
      const created = await prisma.watch.create({
        data: {
          sku: input.sku,
          slug: input.sku.toLowerCase(),
          model: `Modelo ${input.sku}`,
          reference: input.sku,
          retailPrice: PRICE,
          wholesalePrice: 80_000,
          cost: 40_000,
          stock: input.stock,
          status: WatchStatus.DISPONIBLE,
          isActive: true,
          isPublished: input.published ?? true,
          warrantyMonths: input.warrantyMonths,
          movementType: 'Quartz',
          frontImageUrl: `https://cdn.example/${input.sku}.jpg`,
          images: [`https://cdn.example/${input.sku}.jpg`],
          brandId,
        },
      });
      watchIds.push(created.id);
      return created;
    }

    await watch({ sku: skuCash, stock: 2, warrantyMonths: 18 });
    await watch({ sku: skuScan, stock: 3, warrantyMonths: 24 });
    await watch({ sku: skuLast, stock: 1, warrantyMonths: 12 });
    await watch({ sku: skuSpecial, stock: 1, warrantyMonths: 6 });
    await watch({ sku: skuCancel, stock: 2, warrantyMonths: 12 });
    const web = await watch({ sku: skuWeb, stock: 4, warrantyMonths: 12 });
    await prisma.watch.update({
      where: { id: web.id },
      data: {
        categoryId,
        gender: 'Hombre',
        description: 'Reloj de prueba de catálogo',
        videoUrl: 'https://cdn.example/video.mp4',
        primaryImageUrl: `https://cdn.example/${skuWeb}.jpg`,
        secondaryImageUrl: `https://cdn.example/${skuWeb}-2.jpg`,
      },
    });
  });

  afterAll(async () => {
    try {
      const ordersToDrop = orderIds.length
        ? orderIds
        : (
            await prisma.order.findMany({
              where: { sellerId },
              select: { id: true },
            })
          ).map((row) => row.id);
      if (ordersToDrop.length) {
        await prisma.warrantyClaimEvent.deleteMany({
          where: { claim: { receiptItem: { receipt: { orderId: { in: ordersToDrop } } } } },
        });
        await prisma.warrantyClaim.deleteMany({
          where: { receiptItem: { receipt: { orderId: { in: ordersToDrop } } } },
        });
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
      if (expenseIds.length) {
        await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
      }
      if (watchIds.length) {
        await prisma.watch.deleteMany({ where: { id: { in: watchIds } } });
      }
      if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
      if (categoryId) {
        await prisma.category.deleteMany({ where: { id: categoryId } });
      }
      const userIds = [sellerId, adminId].filter(Boolean);
      if (userIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await prisma.$disconnect().catch(() => undefined);
      releaseLock?.();
      releaseLock = undefined;
    }
  });

  function watchId(sku: string) {
    return prisma.watch.findUniqueOrThrow({ where: { sku } });
  }

  it('login de vendedor local y de admin; el vendedor no entra a admin', async () => {
    const seller = await auth.loginWithPassword(
      `${prefix}-seller@pos.local`,
      SELLER_PASSWORD,
    );
    expect(seller.role).toBe(Role.VENDEDOR_LOCAL);
    const admin = await auth.loginWithPassword(
      `${prefix}-admin@pos.local`,
      ADMIN_PASSWORD,
    );
    expect(admin.role).toBe(Role.ADMIN);
    await expect(
      auth.loginWithPassword(`${prefix}-seller@pos.local`, 'mala-clave'),
    ).rejects.toThrow();

    const reflector = new Reflector();
    const roles = new RolesGuard(reflector);
    const financial = new FinancialGuard(reflector);
    const deny = (handler: (...args: never[]) => unknown, controller: new (...args: never[]) => unknown) =>
      expect(() =>
        roles.canActivate(httpContext(Role.VENDEDOR_LOCAL, handler, controller)),
      ).toThrow(ForbiddenException);
    deny(WatchesController.prototype.findAll, WatchesController);
    deny(ExpensesController.prototype.findAll, ExpensesController);
    deny(LabelsController.prototype.pdf, LabelsController);
    deny(PosController.prototype.listCashClosings, PosController);
    expect(
      roles.canActivate(
        httpContext(
          Role.VENDEDOR_LOCAL,
          PosController.prototype.createSale,
          PosController,
        ),
      ),
    ).toBe(true);
    expect(() =>
      financial.canActivate(
        httpContext(
          Role.VENDEDOR_LOCAL,
          DashboardsController.prototype.profit,
          DashboardsController,
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('busca por SKU y código de barras y el catálogo muestra foto, código y stock', async () => {
    const bySku = await catalogPos.findBySku(`  ${skuScan.toLowerCase()}  `);
    expect(bySku.sku).toBe(skuScan);
    expect(bySku.stock).toBe(3);
    expect(bySku.imageUrl).toContain(skuScan);
    const scanned = await catalogPos.searchWatches(skuScan);
    expect(scanned.some((row) => row.sku === skuScan && row.stock === 3)).toBe(
      true,
    );
    const page = await catalogPos.listCatalog({ search: skuScan, page: 1, limit: 12 });
    const card = page.items.find((item) => item.sku === skuScan);
    expect(card).toMatchObject({
      sku: skuScan,
      stock: 3,
    });
    expect(card?.imageUrl).toBeTruthy();
    expect(card?.gallery.length).toBeGreaterThan(0);
  });

  it('vende a precio fijo en efectivo, transferencia y datáfono y descuenta stock', async () => {
    const cashWatch = await watchId(skuCash);
    const sale = await pos.createSale(
      {
        customer: { name: 'Cliente efectivo' },
        items: [{ watchId: cashWatch.id, quantity: 1 }],
        payments: [
          { method: 'EFECTIVO', amount: PRICE, cashReceived: 120_000 },
        ],
      },
      sellerUser(),
    );
    orderIds.push(sale.orderId);
    expect(sale.total).toBe(PRICE);
    expect(sale.changeTotal).toBe(20_000);
    expect(sale.receiptNumber).toMatch(/^LXT-/);
    expect((await watchId(skuCash)).stock).toBe(1);
    const payment = await prisma.orderPayment.findFirstOrThrow({
      where: { orderId: sale.orderId },
    });
    expect(payment.method).toBe(PaymentMethod.EFECTIVO);

    const scanWatch = await watchId(skuScan);
    const transfer = await pos.createSale(
      {
        customer: { name: 'Cliente transferencia', phone: '3001112233' },
        items: [{ watchId: scanWatch.id, quantity: 1 }],
        payments: [
          { method: 'TRANSFERENCIA', amount: PRICE, reference: 'TRX-1' },
        ],
      },
      sellerUser(),
    );
    orderIds.push(transfer.orderId);
    expect((await watchId(skuScan)).stock).toBe(2);
    expect(
      (
        await prisma.orderPayment.findFirstOrThrow({
          where: { orderId: transfer.orderId },
        })
      ).method,
    ).toBe(PaymentMethod.TRANSFERENCIA);

    const bold = await pos.createSale(
      {
        customer: { name: 'Cliente bold' },
        items: [{ watchId: scanWatch.id, quantity: 1 }],
        payments: [
          {
            method: 'DATAFONO_BOLD',
            amount: PRICE,
            approvalCode: '123456',
            cardLast4: '4242',
          },
        ],
      },
      sellerUser(),
    );
    orderIds.push(bold.orderId);
    expect((await watchId(skuScan)).stock).toBe(1);
    const boldPay = await prisma.orderPayment.findFirstOrThrow({
      where: { orderId: bold.orderId },
    });
    expect(boldPay.method).toBe(PaymentMethod.DATAFONO_BOLD);
    expect(boldPay.cardLast4).toBe('4242');
  });

  it('dos ventas simultáneas de la última unidad: solo una y el stock no queda negativo', async () => {
    const last = await watchId(skuLast);
    const dto = {
      customer: { name: 'Ultima unidad' },
      items: [{ watchId: last.id, quantity: 1 }],
      payments: [{ method: 'TRANSFERENCIA' as const, amount: PRICE }],
    };
    const settled = await Promise.allSettled([
      pos.createSale(dto, sellerUser()),
      pos.createSale(dto, sellerUser()),
    ]);
    const ok = settled.flatMap((row) =>
      row.status === 'fulfilled' ? [row.value] : [],
    );
    expect(ok).toHaveLength(1);
    expect(settled.filter((row) => row.status === 'rejected')).toHaveLength(1);
    orderIds.push(ok[0].orderId);
    expect((await watchId(skuLast)).stock).toBe(0);
    await expect(
      pos.createSale(dto, sellerUser()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await watchId(skuLast)).stock).toBe(0);
  });

  it('cada venta local genera comprobante interno con la garantía del reloj y sin DIAN', async () => {
    const cashOrderId = orderIds[0];
    const receipt = await prisma.saleReceipt.findUniqueOrThrow({
      where: { orderId: cashOrderId },
      include: { items: true },
    });
    expect(receipt.channel).toBe('LOCAL');
    expect(receipt.voidedAt).toBeNull();
    expect(receipt.items[0]).toMatchObject({
      sku: skuCash,
      warrantyMonths: 18,
      quantity: 1,
      unitPrice: PRICE,
    });
    expect(receipt.items[0].warrantyEndsAt).not.toBeNull();
    const file = await receipts.getPdf(receipt.id);
    expect(file.buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(file.filename).toContain(receipt.number);
    const stored = await prisma.saleReceiptPdf.findUniqueOrThrow({
      where: { receiptId: receipt.id },
    });
    expect(Buffer.from(stored.data).subarray(0, 4).toString('utf8')).toBe('%PDF');
    const plain = await pdf.render({
      number: receipt.number,
      channel: 'LOCAL',
      saleDate: receipt.saleDate,
      issuedAt: receipt.issuedAt,
      orderReadableId: receipt.orderReadableId,
      customerName: receipt.customerName,
      customerDocument: receipt.customerDocument,
      customerPhone: receipt.customerPhone,
      customerEmail: receipt.customerEmail,
      sellerName: receipt.sellerName,
      subtotal: receipt.subtotal,
      shippingCost: receipt.shippingCost,
      total: receipt.total,
      warrantyTerms: receipt.warrantyTerms,
      footerNote: '',
      businessSnapshot: receipt.businessSnapshot as never,
      payments: receipt.paymentsSnapshot as never,
      items: receipt.items,
      compress: false,
    });
    const text = pdfLiteralText(plain);
    expect(text).toContain('18 meses');
    expect(text).toContain(skuCash);
    expect(text.toLowerCase()).toContain('no es factura electr');
    expect(text).not.toMatch(/CUFE|DIAN/i);
    const byOrder = await receipts.ensureForOrder(cashOrderId);
    expect(byOrder?.id).toBe(receipt.id);
  });

  it('la venta local no calcula comisión', async () => {
    const dashboard = await dashboards.getProfitDashboard('all');
    const local = dashboard.items.find((item) => item.readableId && orderIds.length
      && item.orderId === orderIds[0]);
    expect(local?.channel).toBe('LOCAL');
    expect(local?.commissionPercent).toBe(0);
    expect(local?.commission).toBe(0);
    expect(dashboard.byChannel.local.commission).toBeGreaterThanOrEqual(0);
    const localItems = dashboard.items.filter((item) =>
      orderIds.includes(item.orderId),
    );
    expect(localItems.length).toBeGreaterThan(0);
    for (const item of localItems) {
      expect(item.channel).toBe('LOCAL');
      expect(item.commission).toBe(0);
    }
  });

  it('venta especial exige descripción y usa el precio indicado', async () => {
    const special = await watchId(skuSpecial);
    await expect(
      orders.createSpecialSale(
        { watchId: special.id, salePrice: 70_000, note: '   ' },
        adminId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await watchId(skuSpecial)).stock).toBe(1);
    const created = await orders.createSpecialSale(
      {
        watchId: special.id,
        salePrice: 70_000,
        note: 'Reloj de muestra con caja rota',
      },
      adminId,
    );
    orderIds.push(created.id);
    expect(created.salePrice).toBe(70_000);
    expect(created.note).toBe('Reloj de muestra con caja rota');
    expect(created.receiptNumber).toMatch(/^LXT-/);
    expect((await watchId(skuSpecial)).stock).toBe(0);
    const row = await prisma.order.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.type).toBe('ESPECIAL');
    expect(row.total).toBe(70_000);
  });

  it('anular la venta repone el stock; la transición oficial desde ENTREGADO no', async () => {
    const target = await watchId(skuCancel);
    const sale = await pos.createSale(
      {
        customer: { name: 'Para anular' },
        items: [{ watchId: target.id, quantity: 1 }],
        payments: [{ method: 'TRANSFERENCIA', amount: PRICE }],
      },
      sellerUser(),
    );
    orderIds.push(sale.orderId);
    expect((await watchId(skuCancel)).stock).toBe(1);
    await expect(
      orders.transitionStatus(sale.orderId, OrderStatus.CANCELADO),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await watchId(skuCancel)).stock).toBe(1);
    await orders.updateOrder(sale.orderId, { status: OrderStatus.CANCELADO });
    expect((await watchId(skuCancel)).stock).toBe(2);
    const receipt = await prisma.saleReceipt.findUniqueOrThrow({
      where: { orderId: sale.orderId },
    });
    expect(receipt.voidedAt).not.toBeNull();
  });

  it('gastos de plataforma y local tienen totales separados', async () => {
    const before = await expenses.summary('all');
    const local = await expenses.create(
      { name: `Caja ${prefix}`, amount: 15_000, origin: 'LOCAL' },
      adminId,
    );
    const platform = await expenses.create(
      { name: `Ads ${prefix}`, amount: 40_000, origin: 'PLATAFORMA' },
      adminId,
    );
    expenseIds.push(local.id, platform.id);
    const after = await expenses.summary('all');
    expect(after.byOrigin.LOCAL - before.byOrigin.LOCAL).toBe(15_000);
    expect(after.byOrigin.PLATAFORMA - before.byOrigin.PLATAFORMA).toBe(40_000);
    const onlyLocal = await expenses.summary('all', 'LOCAL');
    expect(onlyLocal.total).toBe(after.byOrigin.LOCAL);
    expect(onlyLocal.byOrigin.PLATAFORMA).toBe(after.byOrigin.PLATAFORMA);
  });

  it('genera etiqueta Code128 del SKU', async () => {
    const watch = await watchId(skuScan);
    const found = await labels.lookup([watch.id]);
    expect(found[0]).toMatchObject({ sku: skuScan, stock: 1 });
    const { buffer, filename } = await labels.buildPdf({
      items: [{ watchId: watch.id, quantity: 1 }],
      layout: 'SHEET_LETTER_3X10',
      includePrice: true,
    });
    expect(filename).toMatch(/\.pdf$/);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.includes(Buffer.from('/Subtype /Image'))).toBe(true);
    const plain = await new LabelPdfRenderer().render(
      [
        {
          id: watch.id,
          sku: skuScan,
          brandName: found[0].brandName,
          model: found[0].model,
          retailPrice: PRICE,
        },
      ],
      { layout: 'SHEET_LETTER_3X10', includePrice: false, compress: false },
    );
    expect(pdfLiteralText(plain)).toContain(skuScan);
  });

  it('abre un reclamo sobre el comprobante y lo pasa a revisión', async () => {
    const receipt = await prisma.saleReceipt.findFirstOrThrow({
      where: { orderId: orderIds[1], voidedAt: null },
      include: { items: true },
    });
    const claim = await claims.create(
      {
        receiptItemId: receipt.items[0].id,
        reportedIssue: 'El reloj se adelanta',
      },
      sellerId,
    );
    expect(claim.status).toBe(WarrantyClaimStatus.RECIBIDO);
    expect(claim.outOfWarranty).toBe(false);
    const updated = await claims.updateStatus(
      claim.id,
      { status: WarrantyClaimStatus.EN_REVISION, note: 'En taller' },
      sellerId,
    );
    expect(updated.status).toBe(WarrantyClaimStatus.EN_REVISION);
    const listed = await claims.findAll({ q: receipt.number });
    expect(listed.items.some((item) => item.id === claim.id)).toBe(true);
  });

  it('REEMPLAZADO descuenta stock una sola vez y el selector oculta costos', async () => {
    const skuRep = `QA-${prefix}-REP`.toUpperCase();
    const skuEmpty = `QA-${prefix}-OUT`.toUpperCase();
    const rep = await prisma.watch.create({
      data: {
        sku: skuRep,
        slug: skuRep.toLowerCase(),
        model: `Modelo ${skuRep}`,
        reference: skuRep,
        retailPrice: PRICE,
        wholesalePrice: 111111,
        cost: 222222,
        stock: 1,
        status: WatchStatus.DISPONIBLE,
        isActive: true,
        isPublished: true,
        warrantyMonths: 12,
        movementType: 'Quartz',
        brandId,
      },
    });
    watchIds.push(rep.id);
    const empty = await prisma.watch.create({
      data: {
        sku: skuEmpty,
        slug: skuEmpty.toLowerCase(),
        model: `Modelo ${skuEmpty}`,
        reference: skuEmpty,
        retailPrice: PRICE,
        wholesalePrice: 111111,
        cost: 222222,
        stock: 0,
        status: WatchStatus.AGOTADO,
        isActive: true,
        isPublished: true,
        warrantyMonths: 12,
        movementType: 'Quartz',
        brandId,
      },
    });
    watchIds.push(empty.id);

    const receipt = await prisma.saleReceipt.findFirstOrThrow({
      where: { orderId: orderIds[1], voidedAt: null },
      include: { items: true },
    });
    const claim = await claims.create(
      {
        receiptItemId: receipt.items[0].id,
        reportedIssue: 'El cristal está rayado',
      },
      sellerId,
    );
    await claims.updateStatus(
      claim.id,
      { status: WarrantyClaimStatus.EN_REVISION },
      sellerId,
    );

    await expect(
      claims.updateStatus(
        claim.id,
        { status: WarrantyClaimStatus.REEMPLAZADO, replacementSku: skuEmpty },
        sellerId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const untouched = await prisma.warrantyClaim.findUniqueOrThrow({
      where: { id: claim.id },
    });
    expect(untouched.status).toBe(WarrantyClaimStatus.EN_REVISION);
    expect(untouched.replacementWatchId).toBeNull();
    expect((await watchId(skuEmpty)).stock).toBe(0);
    expect((await watchId(skuRep)).stock).toBe(1);

    const invalidateTag = cache.invalidateTag.bind(cache);
    const invalidated: string[] = [];
    cache.invalidateTag = (tag: string) => {
      invalidated.push(tag);
      invalidateTag(tag);
    };
    let replaced: Awaited<ReturnType<WarrantyClaimsService['updateStatus']>>;
    try {
      replaced = await claims.updateStatus(
        claim.id,
        {
          status: WarrantyClaimStatus.REEMPLAZADO,
          replacementSku: skuRep.toLowerCase(),
          note: 'entrega en tienda',
        },
        sellerId,
      );
    } finally {
      cache.invalidateTag = invalidateTag;
    }

    expect(invalidated).toContain(CACHE_TAGS.catalog);
    expect((await watchId(skuRep)).stock).toBe(0);
    expect(replaced!.status).toBe(WarrantyClaimStatus.REEMPLAZADO);
    expect(replaced!.replacementSku).toBe(skuRep);
    expect(replaced!.replacementWatch).toMatchObject({
      id: rep.id,
      sku: skuRep,
      brand: `QA POS ${prefix}`,
      model: `Modelo ${skuRep}`,
      price: PRICE,
    });
    expect(replaced!.replacementWatch).not.toHaveProperty('costPrice');
    expect(replaced!.replacementWatch).not.toHaveProperty('wholesalePrice');
    expect(replaced!.replacementWatch).not.toHaveProperty('cost');
    expect(
      replaced!.events.some(
        (event) =>
          event.toStatus === WarrantyClaimStatus.REEMPLAZADO &&
          event.note?.includes(`Reemplazo SKU: ${skuRep}`),
      ),
    ).toBe(true);
    const stored = await prisma.warrantyClaim.findUniqueOrThrow({
      where: { id: claim.id },
    });
    expect(stored.replacementWatchId).toBe(rep.id);

    await prisma.watch.update({
      where: { id: rep.id },
      data: { stock: 5, status: WatchStatus.DISPONIBLE },
    });
    await prisma.warrantyClaim.update({
      where: { id: claim.id },
      data: { status: WarrantyClaimStatus.EN_REVISION },
    });
    await expect(
      claims.updateStatus(
        claim.id,
        { status: WarrantyClaimStatus.REEMPLAZADO, replacementSku: skuRep },
        sellerId,
      ),
    ).rejects.toThrow(/ya descontó/);
    expect((await watchId(skuRep)).stock).toBe(5);
    expect(
      (await prisma.warrantyClaim.findUniqueOrThrow({ where: { id: claim.id } }))
        .status,
    ).toBe(WarrantyClaimStatus.EN_REVISION);

    const options = await claims.listReplacementWatches({ sku: skuRep });
    expect(options.data).toEqual([
      {
        id: rep.id,
        sku: skuRep,
        brand: `QA POS ${prefix}`,
        model: `Modelo ${skuRep}`,
        stock: 5,
        price: PRICE,
      },
    ]);
    const serialized = JSON.stringify(options);
    expect(serialized).not.toContain('costPrice');
    expect(serialized).not.toContain('wholesalePrice');
    expect(serialized).not.toContain('111111');
    expect(serialized).not.toContain('222222');
  });

  it('catálogo público, inventario y pre-pedido web siguen moviendo stock', async () => {
    const web = await watchId(skuWeb);
    const publicWatch = (await storeCatalog.findBySlug(web.slug)) as unknown as {
      sku: string;
      stock: number;
    };
    expect(publicWatch.sku).toBe(skuWeb);
    expect(publicWatch.stock).toBe(4);
    await inventory.updateStock(web.id, { stock: 6 });
    expect((await watchId(skuWeb)).stock).toBe(6);
    const placed = await preOrders.createPublic({
      customerName: 'CLIENTE WEB',
      customerAddress: 'CALLE 1',
      customerPhone: '3000000000',
      consentAccepted: true,
      items: [{ watchId: web.id, quantity: 1 }],
    });
    orderIds.push(placed.order.id);
    expect((await watchId(skuWeb)).stock).toBe(5);
    expect(placed.order.readableId).toMatch(/^LX-/);
    await preOrders.cancelPreOrder(placed.order.id);
    expect((await watchId(skuWeb)).stock).toBe(6);
    const ordersPage = await orders.findAllOrders({ period: 'all', limit: 50 });
    expect(ordersPage.items.some((item) => item.id === orderIds[0])).toBe(true);
  });
});
