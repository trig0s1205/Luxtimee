import { OrderStatus, OrderType, PriceType } from '@prisma/client';
import { DashboardsService } from './dashboards.service';

const NOW = new Date('2026-11-02T15:00:00.000Z');

function serviceWith(order: Record<string, unknown>) {
  const prisma = {
    order: { findMany: async () => [order] },
    watch: { findMany: async () => [] },
  };
  const settings = {
    getCommissionConfig: async () => ({ percent: 0 }),
    getProfitConfig: async () => ({
      reinvestmentPercent: 35,
      ownerProfitPercent: 65,
    }),
  };
  return new DashboardsService(prisma as never, settings as never, {} as never);
}

function watchOrder(payments: Array<{ amount: number; paidAt: Date }>) {
  return {
    id: 'o1',
    readableId: 'LX-1',
    type: OrderType.DETAL,
    status: payments.length > 1 ? OrderStatus.ENTREGADO : OrderStatus.PENDIENTE,
    paidAt: null,
    updatedAt: NOW,
    createdAt: NOW,
    shippingCost: 0,
    shippingZone: null,
    subtotal: 500_000,
    total: 500_000,
    depositExpected: 100_000,
    depositConfirmed: true,
    specialCostSnapshot: null,
    payments,
    items: [
      {
        unitPrice: 50_000,
        quantity: 10,
        priceType: PriceType.RETAIL,
        productName: 'Reloj',
        watch: { cost: 20_000 },
      },
    ],
  };
}

describe('ganancias con abono y saldo', () => {
  it('el abono confirmado entra de inmediato y el saldo no se duplica', async () => {
    const depositOnly = serviceWith(
      watchOrder([{ amount: 100_000, paidAt: NOW }]),
    );
    const partial = await depositOnly.getProfitDashboard('all');
    expect(partial.totalRevenue).toBe(100_000);
    expect(partial.totalCost).toBe(40_000);
    expect(partial.totalProfit).toBe(60_000);
    expect(partial.totalShippingRevenue).toBe(0);

    const settled = serviceWith(
      watchOrder([
        { amount: 100_000, paidAt: NOW },
        { amount: 400_000, paidAt: NOW },
      ]),
    );
    const full = await settled.getProfitDashboard('all');
    expect(full.totalRevenue).toBe(500_000);
    expect(full.totalCost).toBe(200_000);
    expect(full.totalProfit).toBe(300_000);
  });

  it('la venta especial con un solo pago no se cuenta dos veces', async () => {
    const especial = serviceWith({
      id: 'esp',
      readableId: 'LX-ESP',
      type: OrderType.ESPECIAL,
      status: OrderStatus.ENTREGADO,
      paidAt: NOW,
      updatedAt: NOW,
      createdAt: NOW,
      shippingCost: 0,
      shippingZone: null,
      subtotal: 30_000,
      total: 30_000,
      depositExpected: 0,
      depositConfirmed: false,
      specialCostSnapshot: 20_000,
      payments: [{ amount: 30_000, paidAt: NOW }],
      items: [
        {
          unitPrice: 30_000,
          quantity: 1,
          priceType: PriceType.RETAIL,
          productName: 'Rolex',
          watch: { cost: 50_000 },
        },
      ],
    });
    const result = await especial.getProfitDashboard('all');
    expect(result.totalRevenue).toBe(30_000);
    expect(result.totalCost).toBe(20_000);
    expect(result.totalProfit).toBe(10_000);
  });
});
