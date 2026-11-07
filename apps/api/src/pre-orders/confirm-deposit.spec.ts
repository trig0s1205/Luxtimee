import { OrderStage, OrderType, PriceType } from '@prisma/client';
import { PreOrdersService } from './pre-orders.service';

function order(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-11-02T15:00:00.000Z');
  return {
    id: 'o1',
    readableId: 'LX-1',
    stage: OrderStage.PRE_ORDER,
    status: null,
    type: OrderType.DETAL,
    source: 'WEB',
    customerName: 'ANA',
    customerAddress: 'CALLE 1',
    customerEmail: 'ana@test.co',
    customerPhone: '3001234567',
    wholesaleAccessId: null,
    shippingCost: 0,
    depositExpected: 10_000,
    depositConfirmed: false,
    subtotal: 500_000,
    total: 500_000,
    whatsappMessage: null,
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    canceledAt: null,
    suspendedAt: null,
    preOrderActiveAt: now,
    createdAt: now,
    updatedAt: now,
    shippingZone: null,
    items: [
      {
        id: 'i1',
        watchId: 'w1',
        productSku: 'SKU',
        productName: 'Reloj',
        productRef: 'reloj',
        productImage: null,
        quantity: 10,
        unitPrice: 50_000,
        priceType: PriceType.RETAIL,
        deliveryNote: null,
        extrasSnapshot: [],
        packageName: null,
        watch: { sku: 'SKU', frontImageUrl: null },
      },
    ],
    payments: [] as Array<Record<string, unknown>>,
    ...overrides,
  };
}

describe('confirmar abono', () => {
  it('cobra 10.000 por reloj y deja el abono como pago', async () => {
    const created = jest.fn();
    const notifier = { notifyOrder: jest.fn(async () => ({ emailed: false, whatsappUrl: null })) };
    const saved = order({
      stage: OrderStage.ORDER,
      status: 'PENDIENTE',
      depositConfirmed: true,
      depositExpected: 100_000,
      payments: [
        {
          id: 'p1',
          type: 'ABONO',
          amount: 100_000,
          paidAt: new Date('2026-11-02T15:00:00.000Z'),
          registeredById: 'user-1',
          registeredBy: { name: 'Admin' },
        },
      ],
    });
    const tx = {
      order: {
        updateMany: async () => ({ count: 1 }),
        findUniqueOrThrow: async () => saved,
      },
      orderPayment: { create: created },
    };
    const prisma = {
      order: { findUnique: async () => order() },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const service = new PreOrdersService(
      prisma as never,
      { emit: async () => ({ id: 'n' }) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      notifier as never,
      { invalidateTag: () => undefined } as never,
    );

    const result = await service.confirmDeposit('o1', 'user-1');

    expect(created).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'o1',
        type: 'ABONO',
        amount: 100_000,
        registeredById: 'user-1',
      }),
    });
    expect(result.depositPaid).toBe(100_000);
    expect(result.balanceDue).toBe(400_000);
    expect(result.depositExpected).toBe(100_000);
    expect(notifier.notifyOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'deposit_confirmed',
        depositAmount: 100_000,
        unitCount: 10,
      }),
    );
  });
});
