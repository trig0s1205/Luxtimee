import { OrderStage, OrderStatus, OrderType } from '@prisma/client';
import { OrdersService } from './orders.service';

function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    readableId: 'LX-1',
    stage: OrderStage.ORDER,
    status: OrderStatus.PENDIENTE,
    type: OrderType.DETAL,
    source: 'WEB',
    depositConfirmed: true,
    customerName: 'Ana',
    customerAddress: 'Calle 1',
    customerEmail: 'a@b.co',
    customerPhone: null,
    customerDocument: null,
    shippingCost: 0,
    subtotal: 100_000,
    total: 100_000,
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    canceledAt: null,
    items: [
      {
        id: 'i1',
        watchId: 'w1',
        productSku: 'RM-001',
        productName: 'Casio A',
        productRef: 'RM-001',
        productImage: null,
        quantity: 1,
        unitPrice: 100_000,
        priceType: 'RETAIL',
        deliveryNote: null,
        extrasSnapshot: null,
        packageName: null,
        watch: { sku: 'RM-001', frontImageUrl: null },
        warrantyHistory: null,
      },
    ],
    shippingZone: { id: 'z1', name: 'Local', isNational: false },
    payments: [],
    seller: null,
    receipt: null,
    ...overrides,
  };
}

function build(prisma: unknown, receipts: Record<string, unknown>) {
  return new OrdersService(
    prisma as never,
    { emit: jest.fn(async () => ({ id: 'n' })) } as never,
    { generateForOrder: jest.fn(async () => []) } as never,
    { invalidateTag: () => undefined } as never,
    { notifyOrder: jest.fn() } as never,
    receipts as never,
  );
}

describe('OrdersService + comprobantes', () => {
  it('transición a PAGADO llama ensureForOrder una vez', async () => {
    const existing = orderFixture();
    const ensureForOrder = jest.fn(async () => ({ id: 'r1' }));
    const prisma = {
      order: {
        findUnique: jest.fn(async () => existing),
        findUniqueOrThrow: jest.fn(async () => ({
          ...existing,
          status: OrderStatus.PAGADO,
          paidAt: new Date(),
        })),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          order: {
            updateMany: jest.fn(async () => ({ count: 1 })),
            findUniqueOrThrow: jest.fn(async () => ({
              ...existing,
              status: OrderStatus.PAGADO,
              paidAt: new Date(),
            })),
          },
          orderPayment: { updateMany: jest.fn(async () => ({ count: 0 })) },
        };
        return fn(tx);
      }),
    };
    const service = build(prisma, {
      ensureForOrder,
      voidForOrder: jest.fn(),
      issueInTx: jest.fn(),
    });
    await service.transitionStatus('o1', OrderStatus.PAGADO);
    expect(ensureForOrder).toHaveBeenCalledTimes(1);
    expect(ensureForOrder).toHaveBeenCalledWith('o1');
  });

  it('error en ensureForOrder no rompe la transición', async () => {
    const existing = orderFixture();
    const ensureForOrder = jest.fn(async () => {
      throw new Error('fallo comprobante');
    });
    const prisma = {
      order: {
        findUnique: jest.fn(async () => existing),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          order: {
            updateMany: jest.fn(async () => ({ count: 1 })),
            findUniqueOrThrow: jest.fn(async () => ({
              ...existing,
              status: OrderStatus.PAGADO,
              paidAt: new Date(),
            })),
          },
          orderPayment: { updateMany: jest.fn(async () => ({ count: 0 })) },
        };
        return fn(tx);
      }),
    };
    const service = build(prisma, {
      ensureForOrder,
      voidForOrder: jest.fn(),
      issueInTx: jest.fn(),
    });
    await expect(
      service.transitionStatus('o1', OrderStatus.PAGADO),
    ).resolves.toMatchObject({ status: OrderStatus.PAGADO });
  });

  it('cancelar llama voidForOrder', async () => {
    const existing = orderFixture({
      status: OrderStatus.PENDIENTE,
      depositConfirmed: false,
    });
    const voidForOrder = jest.fn(async () => undefined);
    const prisma = {
      order: {
        findUnique: jest.fn(async () => existing),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          order: {
            updateMany: jest.fn(async () => ({ count: 1 })),
            findUniqueOrThrow: jest.fn(async () => ({
              ...existing,
              status: OrderStatus.CANCELADO,
              canceledAt: new Date(),
            })),
          },
          $queryRawUnsafe: jest.fn(async () => []),
        };
        return fn(tx);
      }),
    };
    const service = build(prisma, {
      ensureForOrder: jest.fn(),
      voidForOrder,
      issueInTx: jest.fn(),
    });
    await service.transitionStatus('o1', OrderStatus.CANCELADO);
    expect(voidForOrder).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      'Pedido cancelado',
    );
  });

  it('venta especial emite comprobante en la misma transacción', async () => {
    const issueInTx = jest.fn(async () => ({ id: 'r1', number: 'LXT-000001' }));
    const createdOrder = {
      id: 'order-1',
      readableId: 'LX-ESP',
      createdAt: new Date(),
      total: 30_000,
      specialNote: 'regalo',
      specialSalePrice: 30_000,
      specialCostSnapshot: 20_000,
      specialListPriceSnapshot: 90_000,
      specialSkuSnapshot: 'RM-001',
      specialProfit: 10_000,
      items: [{ productName: 'Rolex Datejust', watch: { sku: 'RM-001' } }],
      receipt: { number: 'LXT-000001', voidedAt: null },
    };
    const prisma = {
      watch: {
        findFirst: jest.fn(async () => ({
          id: 'w1',
          sku: 'RM-001',
          model: 'Datejust',
          retailPrice: 90_000,
          cost: 20_000,
          stock: 2,
          frontImageUrl: null,
          primaryImageUrl: null,
          images: [],
          brand: { name: 'Rolex' },
        })),
      },
      order: {
        count: jest.fn(async () => 0),
        findUniqueOrThrow: jest.fn(async () => createdOrder),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRawUnsafe: jest.fn(async () => [{ id: 'w1' }]),
          order: {
            create: jest.fn(async () => createdOrder),
            findUniqueOrThrow: jest.fn(async () => createdOrder),
          },
        };
        return fn(tx);
      }),
    };
    const service = build(prisma, {
      ensureForOrder: jest.fn(),
      voidForOrder: jest.fn(),
      issueInTx,
    });
    const result = await service.createSpecialSale(
      { watchId: 'w1', salePrice: 30_000, note: 'regalo' },
      'user-1',
    );
    expect(issueInTx).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.objectContaining({ channel: 'WEB', sellerId: 'user-1' }),
    );
    expect(result.receiptNumber).toBe('LXT-000001');
  });
});
