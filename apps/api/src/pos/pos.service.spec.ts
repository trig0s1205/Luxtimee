import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import * as stockTx from '../common/utils/watch-stock.tx';
import { PosService } from './pos.service';

const user = { id: 'seller-1', role: Role.VENDEDOR_LOCAL } as never;

function buildService(overrides: {
  prisma?: Record<string, unknown>;
  receipts?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  cache?: Record<string, unknown>;
}) {
  return new PosService(
    (overrides.prisma ?? {}) as never,
    {} as never,
    (overrides.receipts ?? {
      issueInTx: jest.fn(async () => ({ id: 'rcpt-1', number: 'LXT-000001' })),
      loadReceiptConfig: jest.fn(async () => ({ businessName: 'LUXTIMEE' })),
    }) as never,
    (overrides.notifications ?? { emit: jest.fn(async () => undefined) }) as never,
    (overrides.cache ?? { invalidateTag: jest.fn() }) as never,
    {} as never,
  );
}

describe('PosService.createSale', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rechaza suma de pagos ≠ total sin abrir transacción', async () => {
    const $transaction = jest.fn();
    const service = buildService({
      prisma: {
        watch: {
          findMany: jest.fn(async () => [
            {
              id: 'w1',
              sku: 'RM-001',
              model: 'A',
              reference: null,
              retailPrice: 100_000,
              stock: 2,
              frontImageUrl: null,
              primaryImageUrl: null,
              images: [],
              brand: { name: 'Casio' },
            },
          ]),
        },
        order: { count: jest.fn(async () => 0) },
        $transaction,
      },
    });

    await expect(
      service.createSale(
        {
          customer: { name: 'Ana' },
          items: [{ watchId: 'w1', quantity: 1 }],
          payments: [{ method: 'EFECTIVO', amount: 50_000, cashReceived: 50_000 }],
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('agrupa líneas, usa retailPrice, reserveWatchStock, issueInTx e invalida catálogo', async () => {
    const reserve = jest
      .spyOn(stockTx, 'reserveWatchStock')
      .mockResolvedValue(undefined as never);
    const issueInTx = jest.fn(async () => ({ id: 'rcpt-1', number: 'LXT-000001' }));
    const invalidateTag = jest.fn();
    const emit = jest.fn(async () => undefined);
    let createdData: Record<string, unknown> | null = null;

    const service = buildService({
      receipts: {
        issueInTx,
        loadReceiptConfig: jest.fn(async () => ({ businessName: 'LUXTIMEE' })),
      },
      cache: { invalidateTag },
      notifications: { emit },
      prisma: {
        watch: {
          findMany: jest.fn(async () => [
            {
              id: 'w1',
              sku: 'RM-001',
              model: 'A',
              reference: null,
              retailPrice: 100_000,
              stock: 5,
              frontImageUrl: null,
              primaryImageUrl: null,
              images: [],
              brand: { name: 'Casio' },
            },
          ]),
        },
        order: { findUnique: jest.fn(async () => null) },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            documentCounter: { findUnique: jest.fn(async () => ({ lastValue: 4 })) },
            $queryRaw: jest.fn().mockResolvedValue([{ lastValue: 5 }]),
            order: {
              create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
                createdData = data;
                return { id: 'o1', readableId: data.readableId };
              }),
            },
            orderItem: { createMany: jest.fn(async () => ({ count: 1 })) },
            orderPayment: { createMany: jest.fn(async () => ({ count: 1 })) },
          }),
        ),
      },
    });

    const result = await service.createSale(
      {
        customer: { name: 'Ana' },
        items: [
          { watchId: 'w1', quantity: 1 },
          { watchId: 'w1', quantity: 2 },
        ],
        payments: [{ method: 'EFECTIVO', amount: 300_000, cashReceived: 300_000 }],
      },
      user,
    );

    expect(reserve).toHaveBeenCalledWith(
      expect.anything(),
      [{ watchId: 'w1', quantity: 3 }],
      expect.objectContaining({ requireActive: true }),
    );
    expect(createdData).toEqual(
      expect.objectContaining({ subtotal: 300_000, total: 300_000, customerEmail: null }),
    );
    expect(issueInTx).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      expect.objectContaining({ config: { businessName: 'LUXTIMEE' } }),
    );
    expect(invalidateTag).toHaveBeenCalledWith(CACHE_TAGS.catalog);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'POS_SALE' }),
    );
    expect(result).toMatchObject({
      orderId: 'o1',
      receiptId: 'rcpt-1',
      receiptNumber: 'LXT-000001',
      total: 300_000,
    });
  });

  it('aplica descuentos de línea y de venta y no abre tx si el motivo falta', async () => {
    const $transaction = jest.fn();
    const service = buildService({
      prisma: {
        watch: {
          findMany: jest.fn(async () => [
            {
              id: 'w1',
              sku: 'RM-001',
              model: 'A',
              reference: null,
              retailPrice: 100_000,
              stock: 2,
              frontImageUrl: null,
              primaryImageUrl: null,
              images: [],
              brand: { name: 'Casio' },
            },
          ]),
        },
        $transaction,
      },
    });
    await expect(
      service.createSale(
        {
          customer: { name: 'Ana' },
          items: [{ watchId: 'w1', quantity: 1, discountPercent: 10 }],
          payments: [{ method: 'EFECTIVO', amount: 90_000, cashReceived: 90_000 }],
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('devuelve la venta existente si la clave de idempotencia ya está guardada', async () => {
    const $transaction = jest.fn();
    const service = buildService({
      prisma: {
        order: {
          findUnique: jest.fn(async () => ({
            id: 'o1',
            readableId: 'LX-1',
            total: 100_000,
            payments: [{ changeGiven: 0 }],
            receipt: { id: 'rcpt-1', number: 'LXT-000001' },
          })),
        },
        watch: { findMany: jest.fn() },
        $transaction,
      },
    });
    const result = await service.createSale(
      {
        customer: { name: 'Ana' },
        items: [{ watchId: 'w1', quantity: 1 }],
        payments: [{ method: 'EFECTIVO', amount: 1, cashReceived: 1 }],
        idempotencyKey: '6c1b4b4e-1c1a-4c2a-9c2a-6c1b4b4e1c1a',
      },
      user,
    );
    expect(result.orderId).toBe('o1');
    expect($transaction).not.toHaveBeenCalled();
  });
});
