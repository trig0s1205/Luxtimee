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
      receipts: { issueInTx },
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
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            $queryRaw: jest
              .fn()
              .mockResolvedValueOnce([{ max_seq: 0 }])
              .mockResolvedValueOnce([{ lastValue: 1 }]),
            order: {
              create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
                createdData = data;
                return { id: 'o1', readableId: data.readableId };
              }),
            },
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
    const items = (createdData?.items as { create: Array<{ quantity: number; unitPrice: number }> })
      .create;
    expect(items).toEqual([
      expect.objectContaining({ quantity: 3, unitPrice: 100_000 }),
    ]);
    expect(createdData?.payments).toEqual({
      create: [
        expect.objectContaining({
          method: 'EFECTIVO',
          amount: 300_000,
          registeredById: 'seller-1',
        }),
      ],
    });
    expect(issueInTx).toHaveBeenCalled();
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
});
