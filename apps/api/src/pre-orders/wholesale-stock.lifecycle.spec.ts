import { ConfigService } from '@nestjs/config';
import {
  OrderStage,
  OrderStatus,
  OrderType,
  PriceType,
  PrismaClient,
  WatchStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { WhatsappService } from '../integrations/whatsapp.service';
import { CertificatesService } from '../certificates/certificates.service';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { CustomerNotifier } from '../integrations/customer-notifier.service';
import { WholesaleOffersService } from '../wholesale-offers/wholesale-offers.service';
import { WholesaleAccessService } from '../wholesale-access/wholesale-access.service';
import { hashWholesaleToken } from '../wholesale-access/wholesale-token';
import { PreOrdersService } from './pre-orders.service';
import { OrdersService } from '../orders/orders.service';

jest.setTimeout(60_000);

const NAME = 'CLIENTE STOCK';
const prefix = `stk${Date.now().toString(36)}`;

describe('ciclo de stock mayorista', () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  let preOrders: PreOrdersService;
  let orders: OrdersService;
  let access: WholesaleAccessService;
  let token = '';
  let brandId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL es obligatoria para el ciclo de stock');
    }
    await prisma.$connect();
    const existing = await prisma.order.count();
    if (existing > 0) {
      throw new Error(
        'La base de prueba tiene pedidos. Usa una base vacía.',
      );
    }
    const config = {
      get: (key: string, fallback?: string) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        if (key === 'NODE_ENV') return 'test';
        if (key === 'USE_MOCKS') return 'true';
        return fallback;
      },
    } as ConfigService;
    const notifications = {
      emit: async () => ({ id: 'n' }),
    } as unknown as NotificationsService;
    const settings = {
      getWhatsappLink: async () => ({
        url: 'https://wa.me/573000000000',
        messagePrefix: 'Hola',
      }),
    } as unknown as SettingsService;
    const notifier = {
      notifyOrder: async () => ({ emailed: false, whatsappUrl: null }),
    } as unknown as CustomerNotifier;
    access = new WholesaleAccessService(db, config);
    const offers = new WholesaleOffersService(db);
    preOrders = new PreOrdersService(
      db,
      notifications,
      settings,
      new WhatsappService(config),
      access,
      offers,
      notifier,
    );
    orders = new OrdersService(
      db,
      notifications,
      { generateForOrder: async () => [] } as unknown as CertificatesService,
      new MemoryCacheService(),
      notifier,
    );
    const brand = await prisma.brand.create({
      data: { name: `Marca ${prefix}`, slug: prefix },
    });
    brandId = brand.id;
    const created = await access.create({
      name: 'STOCK TEST',
      email: 'stock@example.com',
      phone: '3001234567',
    });
    token = created.accessToken!;

    const hashed = await prisma.$queryRaw<Array<{ hash: string }>>`
      SELECT encode(digest(convert_to(${token}, 'UTF8'), 'sha256'), 'hex') AS hash
    `;
    expect(hashed[0].hash).toBe(hashWholesaleToken(token));
  });

  afterEach(async () => {
    await prisma.order.deleteMany({ where: { customerName: NAME } });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { customerName: NAME } });
    await prisma.watch.deleteMany({ where: { sku: { startsWith: prefix } } });
    await prisma.wholesaleAccess.deleteMany({
      where: { name: { in: ['STOCK TEST', 'OTRO TOKEN'] } },
    });
    if (brandId) await prisma.brand.delete({ where: { id: brandId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  async function makeWatch(stock: number) {
    const n = Math.random().toString(36).slice(2, 10);
    return prisma.watch.create({
      data: {
        sku: `${prefix}-${n}`,
        slug: `${prefix}-${n}`,
        brandId,
        model: 'Modelo test',
        movementType: 'Cuarzo',
        retailPrice: 100_000,
        wholesalePrice: 80_000,
        stock,
        status: stock > 0 ? WatchStatus.DISPONIBLE : WatchStatus.AGOTADO,
        isActive: true,
        isPublished: true,
      },
    });
  }

  async function stockOf(id: string) {
    const watch = await prisma.watch.findUniqueOrThrow({ where: { id } });
    return { stock: watch.stock, status: watch.status };
  }

  function place(
    items: Array<{ watchId: string; quantity: number }>,
  ) {
    return preOrders.createPublic(
      {
        customerName: NAME,
        customerAddress: 'CALLE 1',
        customerPhone: '3001234567',
        consentAccepted: true,
        items,
      },
      undefined,
      token,
    );
  }

  async function directOrder(watchId: string, depositConfirmed: boolean) {
    const n = Math.random().toString(36).slice(2, 10);
    return prisma.order.create({
      data: {
        readableId: `LX-DIR-${n}`,
        stage: OrderStage.ORDER,
        status: OrderStatus.PENDIENTE,
        type: OrderType.MAYORISTA,
        customerName: NAME,
        customerAddress: 'CALLE 1',
        customerEmail: 'stock@example.com',
        customerPhone: '3001234567',
        depositConfirmed,
        subtotal: 320_000,
        total: 320_000,
        items: {
          create: [
            {
              watchId,
              productName: 'Modelo test',
              productRef: 'modelo',
              quantity: 4,
              unitPrice: 80_000,
              priceType: PriceType.WHOLESALE,
            },
          ],
        },
      },
    });
  }

  it('crear, anular y eliminar reponen el stock exacto', async () => {
    const watch = await makeWatch(10);
    const created = await place([{ watchId: watch.id, quantity: 4 }]);
    expect((await stockOf(watch.id)).stock).toBe(6);
    await preOrders.cancelPreOrder(created.order.id);
    expect((await stockOf(watch.id)).stock).toBe(10);
    await expect(preOrders.cancelPreOrder(created.order.id)).rejects.toThrow();
    expect((await stockOf(watch.id)).stock).toBe(10);

    const again = await place([{ watchId: watch.id, quantity: 4 }]);
    expect((await stockOf(watch.id)).stock).toBe(6);
    await preOrders.deletePreOrder(again.order.id);
    expect((await stockOf(watch.id)).stock).toBe(10);
    expect(await prisma.order.findUnique({ where: { id: again.order.id } })).toBeNull();
  });

  it('rechaza menos de 4 unidades al crear y al editar sin tocar el stock', async () => {
    const watch = await makeWatch(10);
    await expect(place([{ watchId: watch.id, quantity: 3 }])).rejects.toThrow(
      /pedido mínimo mayorista es de 4/,
    );
    expect((await stockOf(watch.id)).stock).toBe(10);
    const created = await place([{ watchId: watch.id, quantity: 4 }]);
    expect((await stockOf(watch.id)).stock).toBe(6);
    await expect(
      preOrders.updatePreOrder(created.order.id, {
        items: [{ watchId: watch.id, quantity: 3 }],
      }),
    ).rejects.toThrow(/pedido mínimo mayorista es de 4/);
    expect((await stockOf(watch.id)).stock).toBe(6);
  });

  it('editar un pre-pedido activo repone lo anterior y reserva lo nuevo', async () => {
    const from = await makeWatch(10);
    const to = await makeWatch(9);
    const created = await place([{ watchId: from.id, quantity: 4 }]);
    expect((await stockOf(from.id)).stock).toBe(6);
    const edited = await preOrders.updatePreOrder(created.order.id, {
      items: [{ watchId: to.id, quantity: 5 }],
    });
    expect(edited.items).toHaveLength(1);
    expect((await stockOf(from.id)).stock).toBe(10);
    expect((await stockOf(to.id)).stock).toBe(4);

    const same = await makeWatch(12);
    const order = await place([{ watchId: same.id, quantity: 4 }]);
    expect((await stockOf(same.id)).stock).toBe(8);
    await preOrders.updatePreOrder(order.order.id, {
      items: [{ watchId: same.id, quantity: 7 }],
    });
    expect((await stockOf(same.id)).stock).toBe(5);
    await preOrders.updatePreOrder(order.order.id, {
      items: [{ watchId: same.id, quantity: 4 }],
    });
    expect((await stockOf(same.id)).stock).toBe(8);

    await expect(
      preOrders.updatePreOrder(order.order.id, {
        items: [{ watchId: same.id, quantity: 100 }],
      }),
    ).rejects.toThrow(/Stock insuficiente/);
    expect((await stockOf(same.id)).stock).toBe(8);
  });

  it('suspender dos veces solo repone una vez; reactivar vuelve a reservar', async () => {
    const watch = await makeWatch(11);
    const created = await place([{ watchId: watch.id, quantity: 4 }]);
    expect((await stockOf(watch.id)).stock).toBe(7);
    await prisma.order.update({
      where: { id: created.order.id },
      data: { preOrderActiveAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    const [first, second] = await Promise.all([
      preOrders.suspendExpiredPreOrders(),
      preOrders.suspendExpiredPreOrders(),
    ]);
    expect(first + second).toBe(1);
    expect((await stockOf(watch.id)).stock).toBe(11);
    const suspended = await prisma.order.findUniqueOrThrow({
      where: { id: created.order.id },
    });
    expect(suspended.suspendedAt).not.toBeNull();
    expect(await preOrders.suspendExpiredPreOrders()).toBe(0);
    expect((await stockOf(watch.id)).stock).toBe(11);

    await preOrders.cancelPreOrder(created.order.id);
    expect((await stockOf(watch.id)).stock).toBe(11);

    const other = await makeWatch(4);
    const held = await place([{ watchId: other.id, quantity: 4 }]);
    expect((await stockOf(other.id)).stock).toBe(0);
    expect((await stockOf(other.id)).status).toBe(WatchStatus.AGOTADO);
    await prisma.order.update({
      where: { id: held.order.id },
      data: { preOrderActiveAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    expect(await preOrders.suspendExpiredPreOrders()).toBe(1);
    expect((await stockOf(other.id)).stock).toBe(4);
    expect((await stockOf(other.id)).status).toBe(WatchStatus.DISPONIBLE);
    await preOrders.deletePreOrder(held.order.id);
    expect((await stockOf(other.id)).stock).toBe(4);

    const third = await makeWatch(11);
    const live = await place([{ watchId: third.id, quantity: 4 }]);
    await prisma.order.update({
      where: { id: live.order.id },
      data: { preOrderActiveAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    expect(await preOrders.suspendExpiredPreOrders()).toBe(1);
    expect((await stockOf(third.id)).stock).toBe(11);
    await preOrders.reactivatePreOrder(live.order.id);
    expect((await stockOf(third.id)).stock).toBe(7);
    await expect(preOrders.reactivatePreOrder(live.order.id)).rejects.toThrow(
      /ya está activo/,
    );
    expect((await stockOf(third.id)).stock).toBe(7);

    const edited = await preOrders.updatePreOrder(live.order.id, {
      items: [{ watchId: third.id, quantity: 6 }],
    });
    expect(edited.suspendedAt).toBeNull();
    expect((await stockOf(third.id)).stock).toBe(5);
    await prisma.order.update({
      where: { id: live.order.id },
      data: { preOrderActiveAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    expect(await preOrders.suspendExpiredPreOrders()).toBe(1);
    expect((await stockOf(third.id)).stock).toBe(11);
    const resumed = await preOrders.updatePreOrder(live.order.id, {
      items: [{ watchId: third.id, quantity: 6 }],
    });
    expect(resumed.suspendedAt).toBeNull();
    expect((await stockOf(third.id)).stock).toBe(5);
  });

  it('confirmar abono no vuelve a descontar; PAGADO por update y por estado tampoco', async () => {
    const watch = await makeWatch(20);
    const created = await place([{ watchId: watch.id, quantity: 4 }]);
    expect((await stockOf(watch.id)).stock).toBe(16);
    const confirmed = await preOrders.confirmDeposit(created.order.id);
    expect(confirmed.depositConfirmed).toBe(true);
    expect(confirmed.status).toBe(OrderStatus.PENDIENTE);
    expect(confirmed.stage).toBe(OrderStage.ORDER);
    expect((await stockOf(watch.id)).stock).toBe(16);
    const paid = await orders.updateOrder(confirmed.id, {
      status: OrderStatus.PAGADO,
    });
    expect(paid.status).toBe(OrderStatus.PAGADO);
    expect((await stockOf(watch.id)).stock).toBe(16);
    const paidAgain = await orders.updateOrder(confirmed.id, {
      status: OrderStatus.PAGADO,
    });
    expect(paidAgain.status).toBe(OrderStatus.PAGADO);
    expect((await stockOf(watch.id)).stock).toBe(16);

    const viaStatus = await makeWatch(16);
    const second = await place([{ watchId: viaStatus.id, quantity: 4 }]);
    const confirmedSecond = await preOrders.confirmDeposit(second.order.id);
    expect((await stockOf(viaStatus.id)).stock).toBe(12);
    const transitioned = await orders.transitionStatus(
      confirmedSecond.id,
      OrderStatus.PAGADO,
    );
    expect(transitioned).toMatchObject({ status: OrderStatus.PAGADO });
    expect((await stockOf(viaStatus.id)).stock).toBe(12);
  });

  it('cancelar desde PENDIENTE con abono repone el stock una sola vez', async () => {
    const byTransition = await makeWatch(18);
    const created = await place([{ watchId: byTransition.id, quantity: 4 }]);
    const confirmed = await preOrders.confirmDeposit(created.order.id);
    expect((await stockOf(byTransition.id)).stock).toBe(14);
    const removed = await orders.transitionStatus(
      confirmed.id,
      OrderStatus.CANCELADO,
    );
    expect(removed).toEqual({ id: confirmed.id, deleted: true });
    expect((await stockOf(byTransition.id)).stock).toBe(18);

    const byUpdate = await makeWatch(13);
    const pending = await place([{ watchId: byUpdate.id, quantity: 4 }]);
    const confirmedUpdate = await preOrders.confirmDeposit(pending.order.id);
    expect((await stockOf(byUpdate.id)).stock).toBe(9);
    const canceled = await orders.updateOrder(confirmedUpdate.id, {
      status: OrderStatus.CANCELADO,
    });
    expect(canceled.status).toBe(OrderStatus.CANCELADO);
    expect((await stockOf(byUpdate.id)).stock).toBe(13);
    await orders.updateOrder(confirmedUpdate.id, {
      status: OrderStatus.CANCELADO,
    });
    expect((await stockOf(byUpdate.id)).stock).toBe(13);
    await orders.deleteOrder(confirmedUpdate.id);
    expect((await stockOf(byUpdate.id)).stock).toBe(13);
  });

  it('sin abono descuenta una sola vez al pasar a PAGADO y repone al cancelar', async () => {
    const byUpdate = await makeWatch(20);
    const updated = await directOrder(byUpdate.id, false);
    expect((await stockOf(byUpdate.id)).stock).toBe(20);
    await orders.updateOrder(updated.id, { status: OrderStatus.PAGADO });
    expect((await stockOf(byUpdate.id)).stock).toBe(16);
    await orders.updateOrder(updated.id, { status: OrderStatus.PAGADO });
    expect((await stockOf(byUpdate.id)).stock).toBe(16);
    await orders.updateOrder(updated.id, { status: OrderStatus.CANCELADO });
    expect((await stockOf(byUpdate.id)).stock).toBe(20);

    const byTransition = await makeWatch(20);
    const transitioned = await directOrder(byTransition.id, false);
    await orders.transitionStatus(transitioned.id, OrderStatus.PAGADO);
    expect((await stockOf(byTransition.id)).stock).toBe(16);
    await expect(
      orders.transitionStatus(transitioned.id, OrderStatus.PAGADO),
    ).rejects.toThrow();
    expect((await stockOf(byTransition.id)).stock).toBe(16);
    await orders.updateOrder(transitioned.id, { status: OrderStatus.CANCELADO });
    expect((await stockOf(byTransition.id)).stock).toBe(20);
  });

  it('varias líneas se reservan y se reponen juntas', async () => {
    const a = await makeWatch(10);
    const b = await makeWatch(10);
    const c = await makeWatch(10);
    const created = await place([
      { watchId: a.id, quantity: 4 },
      { watchId: b.id, quantity: 2 },
      { watchId: c.id, quantity: 3 },
    ]);
    expect((await stockOf(a.id)).stock).toBe(6);
    expect((await stockOf(b.id)).stock).toBe(8);
    expect((await stockOf(c.id)).stock).toBe(7);
    await preOrders.cancelPreOrder(created.order.id);
    expect((await stockOf(a.id)).stock).toBe(10);
    expect((await stockOf(b.id)).stock).toBe(10);
    expect((await stockOf(c.id)).stock).toBe(10);
  });

  it('el token se guarda hasheado y el vencimiento cierra la sesión', async () => {
    const row = await prisma.wholesaleAccess.findFirstOrThrow({
      where: { name: 'STOCK TEST' },
    });
    expect(row.accessTokenHash).toBe(hashWholesaleToken(token));
    expect(await access.getSessionFromToken(token)).toMatchObject({
      email: 'stock@example.com',
    });
    expect(await access.getSessionFromToken(row.accessTokenHash)).toBeNull();

    const issued = await access.create({
      name: 'OTRO TOKEN',
      email: 'otro@example.com',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(issued.accessToken).toBeTruthy();
    expect(issued.accessUrl).toContain(issued.accessToken!);
    expect(await access.getSessionFromToken(issued.accessToken)).toMatchObject({
      id: issued.id,
    });
    await access.update(issued.id, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(await access.getSessionFromToken(issued.accessToken)).toBeNull();
    await expect(
      access.activateSession(issued.accessToken!, {
        cookie() {
          return undefined;
        },
      } as never),
    ).rejects.toThrow(/vencido/);
    await access.update(issued.id, { expiresAt: null });
    expect(await access.getSessionFromToken(issued.accessToken)).toMatchObject({
      id: issued.id,
    });

    const confirmed = await place([
      { watchId: (await makeWatch(8)).id, quantity: 4 },
    ]);
    await preOrders.confirmDeposit(confirmed.order.id);
    const report = await access.report();
    const line = report.items.find((item) => item.name === 'STOCK TEST');
    expect(line).toMatchObject({ orders: 1, units: 4 });
    expect(line!.revenue).toBeGreaterThan(0);
    const history = await access.listOrders(row.id);
    expect(history.total).toBeGreaterThanOrEqual(1);
    expect(history.items.some((item) => item.id === confirmed.order.id)).toBe(
      true,
    );
  });
});
