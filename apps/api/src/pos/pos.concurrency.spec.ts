import { BadRequestException } from '@nestjs/common';
import { PrismaClient, Role, WatchStatus } from '@prisma/client';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { reserveWatchStock } from '../common/utils/watch-stock.tx';
import { PrismaService } from '../prisma/prisma.service';
import { nextReceiptSequence } from '../receipts/receipt-number.util';
import { PosService } from './pos.service';

jest.setTimeout(90_000);

const dbUrl = process.env.DATABASE_URL ?? '';
const isLocalhost = /localhost|127\.0\.0\.1/.test(dbUrl);
const describeLocal = isLocalhost ? describe : describe.skip;

describeLocal('POS concurrency (localhost DB)', () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  const prefix = `posc${Date.now().toString(36)}`;

  let brandId = '';
  let watchId = '';
  let sellerId = '';
  const extraWatchIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
    const brand = await prisma.brand.create({
      data: {
        name: `POS Conc ${prefix}`,
        slug: `pos-conc-${prefix}`,
      },
    });
    brandId = brand.id;

    const seller = await prisma.user.create({
      data: {
        email: `${prefix}@pos.local`,
        name: 'POS Conc Seller',
        role: Role.VENDEDOR_LOCAL,
        passwordHash: 'x',
      },
    });
    sellerId = seller.id;

    const sku = `PC-${prefix.slice(-6).toUpperCase()}`;
    const watch = await prisma.watch.create({
      data: {
        sku,
        slug: `pos-conc-${prefix}`,
        model: 'Concurrency',
        retailPrice: 100_000,
        wholesalePrice: 80_000,
        cost: 50_000,
        stock: 1,
        status: WatchStatus.DISPONIBLE,
        isActive: true,
        movementType: 'Quartz',
        brandId,
      },
    });
    watchId = watch.id;
  });

  afterAll(async () => {
    try {
      if (sellerId) {
        const orders = await prisma.order.findMany({
          where: { sellerId },
          select: { id: true },
        });
        const orderIds = orders.map((o) => o.id);
        if (orderIds.length) {
          await prisma.saleReceiptPdf.deleteMany({
            where: { receipt: { orderId: { in: orderIds } } },
          });
          await prisma.saleReceiptItem.deleteMany({
            where: { receipt: { orderId: { in: orderIds } } },
          });
          await prisma.saleReceipt.deleteMany({
            where: { orderId: { in: orderIds } },
          });
          await prisma.orderPayment.deleteMany({
            where: { orderId: { in: orderIds } },
          });
          await prisma.orderItem.deleteMany({
            where: { orderId: { in: orderIds } },
          });
          await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
        }
        await prisma.cashClosing.deleteMany({ where: { userId: sellerId } });
        await prisma.user.deleteMany({ where: { id: sellerId } });
      }
      const watchIds = [watchId, ...extraWatchIds].filter(Boolean);
      if (watchIds.length) {
        await prisma.watch.deleteMany({ where: { id: { in: watchIds } } });
      }
      if (brandId) {
        await prisma.brand.deleteMany({ where: { id: brandId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  function buildService() {
    return new PosService(
      db,
      {} as never,
      {
        issueInTx: jest.fn(async (tx: unknown, orderId: string) => {
          const seq = await nextReceiptSequence(tx as never);
          return {
            id: `r-${orderId}`,
            number: `LXT-${String(seq).padStart(6, '0')}`,
            sequence: seq,
          };
        }),
      } as never,
      { emit: jest.fn(async () => ({ id: 'n' })) } as never,
      new MemoryCacheService(),
      {} as never,
    );
  }

  it('dos reservas concurrentes con stock 1: solo una gana', async () => {
    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        reserveWatchStock(tx, [{ watchId, quantity: 1 }], {
          requireActive: true,
        }),
      ),
      prisma.$transaction((tx) =>
        reserveWatchStock(tx, [{ watchId, quantity: 1 }], {
          requireActive: true,
        }),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const watch = await prisma.watch.findUniqueOrThrow({ where: { id: watchId } });
    expect(watch.stock).toBe(0);
    await prisma.watch.update({
      where: { id: watchId },
      data: { stock: 1, status: WatchStatus.DISPONIBLE },
    });
  });

  it('createSale concurrente con stock 1: solo una venta', async () => {
    const service = buildService();
    const dto = {
      customer: { name: 'Cliente concurrencia' },
      items: [{ watchId, quantity: 1 }],
      payments: [
        { method: 'EFECTIVO' as const, amount: 100_000, cashReceived: 100_000 },
      ],
    };
    const user = { id: sellerId, role: Role.VENDEDOR_LOCAL };
    const results = await Promise.allSettled([
      service.createSale(dto, user as never),
      service.createSale(dto, user as never),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const watch = await prisma.watch.findUniqueOrThrow({ where: { id: watchId } });
    expect(watch.stock).toBe(0);
  });

  it('stock 0 falla', async () => {
    await prisma.watch.update({
      where: { id: watchId },
      data: { stock: 0, status: WatchStatus.AGOTADO },
    });
    await expect(
      buildService().createSale(
        {
          customer: { name: 'Sin stock' },
          items: [{ watchId, quantity: 1 }],
          payments: [
            { method: 'EFECTIVO', amount: 100_000, cashReceived: 100_000 },
          ],
        },
        { id: sellerId, role: Role.VENDEDOR_LOCAL } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('15 recibos paralelos: secuencias consecutivas', async () => {
    const watches = await Promise.all(
      Array.from({ length: 15 }, async (_, i) => {
        const created = await prisma.watch.create({
          data: {
            sku: `PC-${prefix}-S${i}`,
            slug: `pos-conc-${prefix}-s${i}-${Date.now()}`,
            model: `Seq ${i}`,
            retailPrice: 100_000,
            wholesalePrice: 80_000,
            stock: 1,
            status: WatchStatus.DISPONIBLE,
            isActive: true,
            movementType: 'Quartz',
            brandId,
          },
        });
        extraWatchIds.push(created.id);
        return created.id;
      }),
    );
    const service = buildService();
    const settled = await Promise.allSettled(
      watches.map((id) =>
        service.createSale(
          {
            customer: { name: 'Seq' },
            items: [{ watchId: id, quantity: 1 }],
            payments: [{ method: 'TRANSFERENCIA', amount: 100_000 }],
          },
          { id: sellerId, role: Role.VENDEDOR_LOCAL } as never,
        ),
      ),
    );
    const ok = settled.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(15);
    const sequences = ok
      .map((item) =>
        Number(
          (item as PromiseFulfilledResult<{ receiptNumber: string }>).value
            .receiptNumber.replace(/^LXT-/, ''),
        ),
      )
      .sort((a, b) => a - b);
    expect(new Set(sequences).size).toBe(15);
    for (let i = 1; i < sequences.length; i += 1) {
      expect(sequences[i]).toBe(sequences[i - 1] + 1);
    }
  });

  it('rollback de nextReceiptSequence no deja hueco', async () => {
    const rolled = await prisma
      .$transaction(async (tx) => {
        const seq = await nextReceiptSequence(tx);
        throw new Error(`rollback-${seq}`);
      })
      .catch((error: Error) => error.message);
    const seqUsed = Number(rolled.replace('rollback-', ''));
    const after = await prisma.$transaction((tx) => nextReceiptSequence(tx));
    expect(after).toBe(seqUsed);
  });
});
