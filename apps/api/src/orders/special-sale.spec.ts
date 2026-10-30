import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrderStatus, OrderType, PriceType, Role } from '@prisma/client';
import { DashboardsService } from '../dashboards/dashboards.service';
import { ROLES_KEY } from '../common/decorators/metadata.decorators';
import { OrdersController } from './orders.controller';
import { OrdersService, isInventoryDeducted } from './orders.service';
import { priceOrderLines, resolveOrderType } from './order-pricing.util';
import {
  assertSpecialSaleInput,
  computeSpecialSaleProfit,
  profitBreakdownFromLine,
} from './special-sale.util';

const LIST = 90_000;
const COST = 20_000;
const SALE = 30_000;

function watchFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    sku: 'SKU-1',
    model: 'Datejust',
    retailPrice: LIST,
    cost: COST,
    stock: 2,
    deletedAt: null,
    frontImageUrl: null,
    primaryImageUrl: null,
    images: [] as string[],
    brand: { name: 'Rolex' },
    ...overrides,
  };
}

function buildOrdersService(prisma: unknown, notifier = { notifyOrder: jest.fn() }) {
  return {
    service: new OrdersService(
      prisma as never,
      { emit: async () => ({ id: 'n' }) } as never,
      { generateForOrder: jest.fn(async () => []) } as never,
      { invalidateTag: () => undefined } as never,
      notifier as never,
    ),
    notifier,
  };
}

describe('ganancia de venta especial', () => {
  it('resta el costo al precio vendido', () => {
    expect(computeSpecialSaleProfit(SALE, COST)).toBe(10_000);
    expect(computeSpecialSaleProfit(10_000, COST)).toBe(-10_000);
  });

  it('exige precio mayor a 0 y nota', () => {
    expect(assertSpecialSaleInput({ salePrice: SALE, note: '  mamá de Álvaro ' }).note).toBe(
      'mamá de Álvaro',
    );
    expect(() => assertSpecialSaleInput({ salePrice: 0, note: 'mamá' })).toThrow(
      BadRequestException,
    );
    expect(() => assertSpecialSaleInput({ salePrice: -1, note: 'mamá' })).toThrow(
      /mayor a 0/,
    );
    expect(() => assertSpecialSaleInput({ salePrice: SALE, note: '   ' })).toThrow(
      /nota es obligatoria/,
    );
  });

  it('el detal sigue usando el costo vivo y la comisión de siempre', () => {
    const detal = profitBreakdownFromLine({
      orderType: OrderType.DETAL,
      unitPrice: LIST,
      quantity: 1,
      liveCost: COST,
      costSnapshot: 1,
      commissionPercent: 5,
    });
    expect(detal).toEqual({
      revenue: LIST,
      cost: COST,
      grossProfit: 70_000,
      commission: 3_500,
      profit: 66_500,
    });

    const especial = profitBreakdownFromLine({
      orderType: OrderType.ESPECIAL,
      unitPrice: SALE,
      quantity: 1,
      liveCost: 50_000,
      costSnapshot: COST,
      commissionPercent: 5,
    });
    expect(especial.cost).toBe(COST);
    expect(especial.grossProfit).toBe(10_000);
    expect(especial.commission).toBe(500);
    expect(especial.profit).toBe(9_500);
  });
});

describe('finanzas incluyen la venta especial', () => {
  it('suma el precio vendido y el costo congelado, y deja el detal igual', async () => {
    const now = new Date('2026-10-30T12:00:00.000Z');
    const detal = {
      id: 'detal',
      readableId: 'LX-DETAL',
      type: OrderType.DETAL,
      status: OrderStatus.ENTREGADO,
      paidAt: now,
      updatedAt: now,
      createdAt: now,
      shippingCost: 0,
      shippingZone: null,
      specialCostSnapshot: null,
      items: [
        {
          unitPrice: LIST,
          quantity: 1,
          priceType: PriceType.RETAIL,
          productName: 'Rolex lista',
          watch: { cost: COST },
        },
      ],
    };
    const especial = {
      id: 'esp',
      readableId: 'LX-ESP',
      type: OrderType.ESPECIAL,
      status: OrderStatus.ENTREGADO,
      paidAt: now,
      updatedAt: now,
      createdAt: now,
      shippingCost: 0,
      shippingZone: null,
      specialCostSnapshot: COST,
      items: [
        {
          unitPrice: SALE,
          quantity: 1,
          priceType: PriceType.RETAIL,
          productName: 'Rolex Datejust',
          watch: { cost: 50_000 },
        },
      ],
    };
    const prisma = {
      order: { findMany: async () => [detal, especial] },
      watch: { findMany: async () => [] },
    };
    const settings = {
      getCommissionConfig: async () => ({ percent: 0 }),
      getProfitConfig: async () => ({
        reinvestmentPercent: 35,
        ownerProfitPercent: 65,
      }),
    };
    const service = new DashboardsService(
      prisma as never,
      settings as never,
      {} as never,
    );

    const result = await service.getProfitDashboard('all');
    const detalItem = result.items.find((item) => item.orderType === OrderType.DETAL);
    const especialItem = result.items.find((item) => item.orderType === OrderType.ESPECIAL);

    expect(detalItem).toMatchObject({ revenue: LIST, cost: COST, profit: 70_000 });
    expect(especialItem).toMatchObject({
      revenue: SALE,
      cost: COST,
      profit: 10_000,
      orderType: OrderType.ESPECIAL,
    });
    expect(result.totalRevenue).toBe(LIST + SALE);
    expect(result.totalCost).toBe(COST + COST);
    expect(result.totalGrossProfit).toBe(80_000);
    expect(result.totalProfit).toBe(80_000);
  });
});

describe('stock de venta especial', () => {
  it('descuenta una unidad y guarda precio, lista, costo, sku y ganancia', async () => {
    const watch = watchFixture();
    let sql = '';
    const tx = {
      $queryRawUnsafe: async (query: string) => {
        sql = query;
        watch.stock -= 1;
        return [{ id: watch.id }];
      },
      order: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'order-1',
          readableId: data.readableId,
          createdAt: new Date('2026-10-30T12:00:00.000Z'),
          total: data.total,
          specialNote: data.specialNote,
          specialSalePrice: data.specialSalePrice,
          specialCostSnapshot: data.specialCostSnapshot,
          specialListPriceSnapshot: data.specialListPriceSnapshot,
          specialSkuSnapshot: data.specialSkuSnapshot,
          specialProfit: data.specialProfit,
          items: [
            {
              productName: 'Rolex Datejust',
              watch: { sku: watch.sku },
            },
          ],
          data,
        }),
      },
    };
    const prisma = {
      watch: { findFirst: async () => watch },
      order: { count: async () => 4 },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const { service, notifier } = buildOrdersService(prisma);
    const created = await service.createSpecialSale({
      watchId: watch.id,
      salePrice: SALE,
      note: 'mamá de Álvaro',
    });

    expect(sql).toContain('w.stock - v.qty');
    expect(watch.stock).toBe(1);
    expect(created).toMatchObject({
      watchName: 'Rolex Datejust',
      sku: 'SKU-1',
      listPrice: LIST,
      salePrice: SALE,
      cost: COST,
      profit: 10_000,
      note: 'mamá de Álvaro',
    });
    expect(notifier.notifyOrder).not.toHaveBeenCalled();
  });

  it('persiste el tipo especial sin datos de cliente', async () => {
    const watch = watchFixture();
    let stored: Record<string, unknown> | null = null;
    const tx = {
      $queryRawUnsafe: async () => [{ id: watch.id }],
      order: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return {
            id: 'order-1',
            readableId: data.readableId,
            createdAt: new Date(),
            total: SALE,
            specialNote: data.specialNote,
            specialSalePrice: SALE,
            specialCostSnapshot: COST,
            specialListPriceSnapshot: LIST,
            specialSkuSnapshot: 'SKU-1',
            specialProfit: 10_000,
            items: [{ productName: 'Rolex Datejust', watch: { sku: 'SKU-1' } }],
          };
        },
      },
    };
    const prisma = {
      watch: { findFirst: async () => watch },
      order: { count: async () => 0 },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const { service } = buildOrdersService(prisma);
    await service.createSpecialSale({
      watchId: 'w1',
      salePrice: SALE,
      note: 'mamá de Álvaro',
    });
    expect(stored).toMatchObject({
      type: OrderType.ESPECIAL,
      status: OrderStatus.ENTREGADO,
      customerName: '',
      customerAddress: '',
      customerEmail: '',
      customerPhone: null,
      specialSalePrice: SALE,
      specialCostSnapshot: COST,
      specialListPriceSnapshot: LIST,
      specialSkuSnapshot: 'SKU-1',
      specialProfit: 10_000,
      specialNote: 'mamá de Álvaro',
    });
    const items = stored?.items as { create: Array<{ unitPrice: number; quantity: number }> };
    expect(items.create[0]).toMatchObject({ unitPrice: SALE, quantity: 1 });
  });

  it('bloquea stock 0 y no crea el pedido', async () => {
    const tx = jest.fn();
    const prisma = {
      watch: { findFirst: async () => watchFixture({ stock: 0 }) },
      order: { count: async () => 0 },
      $transaction: tx,
    };
    const { service } = buildOrdersService(prisma);
    await expect(
      service.createSpecialSale({ watchId: 'w1', salePrice: SALE, note: 'regalo' }),
    ).rejects.toThrow(/Sin stock/);
    expect(tx).not.toHaveBeenCalled();
  });

  it('no crea el pedido si la reserva concurrente se queda sin stock', async () => {
    const create = jest.fn();
    const tx = {
      $queryRawUnsafe: async () => [],
      order: { create },
    };
    const prisma = {
      watch: { findFirst: async () => watchFixture({ stock: 1 }) },
      order: { count: async () => 0 },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const { service } = buildOrdersService(prisma);
    await expect(
      service.createSpecialSale({ watchId: 'w1', salePrice: SALE, note: 'regalo' }),
    ).rejects.toThrow(/Sin stock/);
    expect(create).not.toHaveBeenCalled();
  });

  it('rechaza reloj inexistente o sin costo', async () => {
    const missing = {
      watch: { findFirst: async () => null },
      order: { count: async () => 0 },
      $transaction: jest.fn(),
    };
    const { service: missingService } = buildOrdersService(missing);
    await expect(
      missingService.createSpecialSale({ watchId: 'no', salePrice: SALE, note: 'regalo' }),
    ).rejects.toThrow(/no existe/);

    const noCost = {
      watch: { findFirst: async () => watchFixture({ cost: null }) },
      order: { count: async () => 0 },
      $transaction: jest.fn(),
    };
    const { service: noCostService } = buildOrdersService(noCost);
    await expect(
      noCostService.createSpecialSale({ watchId: 'w1', salePrice: SALE, note: 'regalo' }),
    ).rejects.toThrow(/no tiene costo/);
    expect(noCost.$transaction).not.toHaveBeenCalled();
  });

  it('al eliminar repone el stock, igual que un pedido ya descontado', async () => {
    let sql = '';
    const deleted = jest.fn(async () => ({}));
    const tx = {
      order: {
        updateMany: async () => ({ count: 1 }),
        delete: deleted,
      },
      $queryRawUnsafe: async (query: string) => {
        sql = query;
        return [{ id: 'w1' }];
      },
    };
    const prisma = {
      order: {
        findUnique: async () => ({
          id: 'order-1',
          stage: 'ORDER',
          status: OrderStatus.ENTREGADO,
          depositConfirmed: false,
          items: [{ watchId: 'w1', quantity: 1 }],
        }),
      },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const { service, notifier } = buildOrdersService(prisma);
    expect(
      isInventoryDeducted({
        status: OrderStatus.ENTREGADO,
        depositConfirmed: false,
      }),
    ).toBe(true);
    await service.deleteOrder('order-1');
    expect(sql).toContain('w.stock + v.qty');
    expect(deleted).toHaveBeenCalled();
    expect(notifier.notifyOrder).not.toHaveBeenCalled();
  });
});

describe('flujos de pedido existentes', () => {
  it('el precio detal y mayorista no cambia', () => {
    expect(resolveOrderType(4, 'retail')).toBe(OrderType.DETAL);
    expect(resolveOrderType(4, 'wholesale')).toBe(OrderType.MAYORISTA);
    const retail = priceOrderLines(
      [
        {
          watchId: '1',
          quantity: 4,
          retailPrice: LIST,
          wholesalePrice: 80_000,
          productName: 'A',
          productRef: 'a',
        },
      ],
      0,
      'retail',
    );
    expect(retail.type).toBe(OrderType.DETAL);
    expect(retail.lines[0].unitPrice).toBe(LIST);
    expect(retail.lines[0].priceType).toBe(PriceType.RETAIL);

    const wholesale = priceOrderLines(
      [
        {
          watchId: '1',
          quantity: 4,
          retailPrice: LIST,
          wholesalePrice: 80_000,
          productName: 'A',
          productRef: 'a',
        },
      ],
      0,
      'wholesale',
    );
    expect(wholesale.type).toBe(OrderType.MAYORISTA);
    expect(wholesale.lines[0].unitPrice).toBe(80_000);
    expect(wholesale.depositExpected).toBe(40_000);
  });

  it('el listado detal y el de ventas entregadas no mezclan ventas especiales', async () => {
    const captured: Array<Record<string, unknown>> = [];
    const prisma = {
      order: {
        count: async ({ where }: { where: Record<string, unknown> }) => {
          captured.push(where);
          return 0;
        },
        findMany: async () => [],
      },
    };
    const { service } = buildOrdersService(prisma);
    await service.findAllOrders({ period: 'all', type: OrderType.DETAL });
    await service.findAllOrders({ period: 'all' });
    await service.findSales();
    expect(captured[0].type).toBe(OrderType.DETAL);
    expect(captured[1].type).toEqual({ not: OrderType.ESPECIAL });
    expect(captured[2]).toMatchObject({
      stage: 'ORDER',
      status: OrderStatus.ENTREGADO,
      type: { not: OrderType.ESPECIAL },
    });
  });

  it('usa la misma autorización de admin que el resto de pedidos', () => {
    const roles = new Reflector().get<Role[]>(ROLES_KEY, OrdersController);
    expect(roles).toEqual([Role.ADMIN, Role.SUPER_ADMIN]);
  });
});
