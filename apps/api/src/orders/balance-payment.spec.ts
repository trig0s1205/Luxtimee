import { OrderStage, OrderStatus, OrderType, PriceType } from '@prisma/client';
import { OrdersService } from './orders.service';

function order(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-11-02T15:00:00.000Z');
  return {
    id: 'o1',
    readableId: 'LX-1',
    stage: OrderStage.ORDER,
    status: OrderStatus.PAGADO,
    type: OrderType.DETAL,
    source: 'WEB',
    customerName: 'ANA',
    customerAddress: 'CALLE 1',
    customerEmail: '',
    customerPhone: '3001234567',
    wholesaleAccessId: null,
    shippingCost: 0,
    depositExpected: 100_000,
    depositConfirmed: true,
    subtotal: 500_000,
    total: 500_000,
    whatsappMessage: null,
    paidAt: now,
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
        warrantyHistory: null,
      },
    ],
    payments: [
      {
        id: 'p1',
        type: 'ABONO',
        amount: 100_000,
        paidAt: now,
        registeredById: null,
        registeredBy: null,
      },
    ],
    ...overrides,
  };
}

function build(prisma: unknown) {
  return new OrdersService(
    prisma as never,
    { emit: async () => ({ id: 'n' }) } as never,
    { generateForOrder: jest.fn(async () => []) } as never,
    { invalidateTag: () => undefined } as never,
    { notifyOrder: jest.fn() } as never,
  );
}

describe('pago del saldo', () => {
  it('registra el faltante y no deja saldo en cero dos veces', async () => {
    const created = jest.fn(async ({ data }: { data: { amount: number } }) => data);
    let payments = order().payments;
    const tx = {
      $queryRaw: async () => [{ id: 'o1' }],
      orderPayment: {
        aggregate: async () => ({
          _sum: { amount: payments.reduce((sum, payment) => sum + payment.amount, 0) },
        }),
        create: async (input: { data: { amount: number; type: string } }) => {
          created(input);
          payments = [
            ...payments,
            {
              id: 'p2',
              type: input.data.type,
              amount: input.data.amount,
              paidAt: new Date(),
              registeredById: 'user-1',
              registeredBy: { name: 'Admin' },
            },
          ];
          return input.data;
        },
      },
      order: {
        findUniqueOrThrow: async () => order({ payments, balanceDue: undefined }),
      },
    };
    const prisma = {
      order: { findUnique: async () => order() },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const service = build(prisma);
    const result = await service.registerBalancePayment('o1', 'user-1');
    expect(created).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'SALDO',
        amount: 400_000,
        registeredById: 'user-1',
      }),
    });
    expect(result.balanceDue).toBe(0);
    expect(result.paidTotal).toBe(500_000);

    await expect(service.registerBalancePayment('o1', 'user-1')).rejects.toThrow(
      /no tiene saldo pendiente/,
    );
  });

  it('entregar con saldo pendiente exige confirmación y luego lo registra', async () => {
    const created = jest.fn();
    const tx = {
      $queryRaw: async () => [{ id: 'o1' }],
      order: {
        updateMany: async () => ({ count: 1 }),
        findUniqueOrThrow: async () =>
          order({
            status: OrderStatus.ENTREGADO,
            payments: [
              ...order().payments,
              {
                id: 'p2',
                type: 'SALDO',
                amount: 400_000,
                paidAt: new Date(),
                registeredById: 'user-1',
                registeredBy: null,
              },
            ],
          }),
      },
      orderPayment: {
        aggregate: async () => ({ _sum: { amount: 100_000 } }),
        create: created,
      },
    };
    const prisma = {
      order: { findUnique: async () => order() },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const service = build(prisma);

    await expect(
      service.transitionStatus('o1', OrderStatus.ENTREGADO),
    ).rejects.toThrow(/Falta por pagar/);
    expect(created).not.toHaveBeenCalled();

    await service.transitionStatus('o1', OrderStatus.ENTREGADO, {
      confirmBalancePaid: true,
      registeredById: 'user-1',
    });
    expect(created).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'SALDO', amount: 400_000 }),
    });
  });
});
