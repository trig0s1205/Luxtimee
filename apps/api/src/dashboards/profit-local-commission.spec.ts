import {
  OrderSource,
  OrderStatus,
  OrderType,
  PriceType,
} from '@prisma/client';
import { DashboardsService } from './dashboards.service';

const NOW = new Date('2026-11-02T15:00:00.000Z');

function serviceWith(
  orders: Array<Record<string, unknown>>,
  commissionPercent = 10,
) {
  const prisma = {
    order: { findMany: async () => orders },
    watch: { findMany: async () => [] },
  };
  const settings = {
    getCommissionConfig: async () => ({ percent: commissionPercent }),
    getProfitConfig: async () => ({
      reinvestmentPercent: 35,
      ownerProfitPercent: 65,
    }),
  };
  return new DashboardsService(prisma as never, settings as never, {} as never);
}

function baseOrder(
  overrides: Record<string, unknown> & {
    source: OrderSource;
    type?: OrderType;
  },
) {
  return {
    id: 'o1',
    readableId: 'LX-1',
    type: OrderType.DETAL,
    status: OrderStatus.ENTREGADO,
    paidAt: null,
    updatedAt: NOW,
    createdAt: NOW,
    shippingCost: 0,
    shippingZone: null,
    subtotal: 100_000,
    total: 100_000,
    depositExpected: 0,
    depositConfirmed: false,
    specialCostSnapshot: null,
    payments: [{ amount: 100_000, paidAt: NOW }],
    items: [
      {
        unitPrice: 100_000,
        quantity: 1,
        priceType: PriceType.RETAIL,
        productName: 'Reloj',
        watch: { cost: 40_000 },
      },
    ],
    ...overrides,
  };
}

describe('comisión solo en canal web', () => {
  it('WEB aplica comisión y LOCAL no', async () => {
    const web = await serviceWith([
      baseOrder({ id: 'web', readableId: 'LX-WEB', source: OrderSource.WEB }),
    ]).getProfitDashboard('all');
    expect(web.items[0].channel).toBe('WEB');
    expect(web.items[0].commissionPercent).toBe(10);
    expect(web.items[0].commission).toBe(6_000);
    expect(web.items[0].profit).toBe(54_000);
    expect(web.totalCommission).toBe(6_000);
    expect(web.byChannel.web.commission).toBe(6_000);
    expect(web.byChannel.local.commission).toBe(0);

    const local = await serviceWith([
      baseOrder({
        id: 'local',
        readableId: 'LX-LOC',
        source: OrderSource.LOCAL,
      }),
    ]).getProfitDashboard('all');
    expect(local.items[0].channel).toBe('LOCAL');
    expect(local.items[0].commissionPercent).toBe(0);
    expect(local.items[0].commission).toBe(0);
    expect(local.items[0].profit).toBe(60_000);
    expect(local.totalCommission).toBe(0);
    expect(local.byChannel.local.profit).toBe(60_000);
    expect(local.byChannel.web.commission).toBe(0);
  });

  it('mezcla web+local suma comisiones solo de web', async () => {
    const result = await serviceWith([
      baseOrder({ id: 'web', readableId: 'LX-WEB', source: OrderSource.WEB }),
      baseOrder({
        id: 'local',
        readableId: 'LX-LOC',
        source: OrderSource.LOCAL,
      }),
    ]).getProfitDashboard('all');

    expect(result.totalRevenue).toBe(200_000);
    expect(result.totalCost).toBe(80_000);
    expect(result.totalCommission).toBe(6_000);
    expect(result.totalProfit).toBe(114_000);
    expect(result.byChannel.web.revenue).toBe(100_000);
    expect(result.byChannel.local.revenue).toBe(100_000);
    expect(result.byChannel.total.commission).toBe(6_000);
  });

  it('ESPECIAL con WEB sigue pagando comisión', async () => {
    const result = await serviceWith([
      baseOrder({
        id: 'esp',
        readableId: 'LX-ESP',
        source: OrderSource.WEB,
        type: OrderType.ESPECIAL,
        specialCostSnapshot: 40_000,
        items: [
          {
            unitPrice: 100_000,
            quantity: 1,
            priceType: PriceType.RETAIL,
            productName: 'Rolex',
            watch: { cost: 50_000 },
          },
        ],
      }),
    ]).getProfitDashboard('all');

    expect(result.items[0].channel).toBe('WEB');
    expect(result.items[0].commissionPercent).toBe(10);
    expect(result.items[0].commission).toBe(6_000);
    expect(result.totalCommission).toBe(6_000);
    expect(result.totalProfit).toBe(54_000);
  });
});
