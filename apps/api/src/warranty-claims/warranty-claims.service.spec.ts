import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, WarrantyClaimStatus } from '@prisma/client';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  buildReceiptSearchWhere,
  normalizeReceiptNumberQuery,
} from '../receipts/receipt-search.util';
import { WatchesController } from '../watches/watches.controller';
import { WarrantyClaimsController } from './warranty-claims.controller';
import { WarrantyClaimsService } from './warranty-claims.service';

describe('receipt search helpers', () => {
  it('normaliza "123" → LXT-000123', () => {
    expect(normalizeReceiptNumberQuery('123')).toBe('LXT-000123');
    expect(normalizeReceiptNumberQuery('000123')).toBe('LXT-000123');
    expect(normalizeReceiptNumberQuery('LXT-000123')).toBe('LXT-000123');
  });

  it('búsqueda "rm-001" arma filtro items.some.sku insensible', () => {
    const where = buildReceiptSearchWhere('rm-001');
    const skuOr = (where.OR ?? []).find(
      (clause) =>
        clause.items &&
        typeof clause.items === 'object' &&
        'some' in clause.items,
    );
    expect(skuOr).toEqual({
      items: {
        some: { sku: { contains: 'rm-001', mode: 'insensitive' } },
      },
    });
    const serialized = JSON.stringify(where);
    expect(serialized.toLowerCase()).not.toContain('serial');
  });
});

function httpContext(
  role: Role,
  handler: (...args: never[]) => unknown,
  controller: new (...args: never[]) => unknown,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as unknown as ExecutionContext;
}

function detailFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    status: overrides.status ?? WarrantyClaimStatus.REEMPLAZADO,
    reportedIssue: 'falla',
    notes: null,
    outOfWarranty: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    resolvedAt: overrides.resolvedAt ?? new Date('2026-01-02T00:00:00Z'),
    deliveredAt: overrides.deliveredAt ?? null,
    replacementSku: overrides.replacementSku ?? null,
    replacementWatch: overrides.replacementWatch ?? null,
    receiptItem: {
      productName: 'Casio A',
      sku: 'RM-001',
      limitedEditionNumber: null,
      brandName: 'Casio',
      model: 'A',
      receipt: {
        id: 'r1',
        number: 'LXT-000001',
        customerName: 'Ana',
        customerPhone: null,
        customerDocument: null,
        saleDate: new Date('2026-01-01T00:00:00Z'),
        voidedAt: null,
      },
    },
    events: overrides.events ?? [],
    createdBy: { id: 'user-1', name: 'Admin' },
  };
}

describe('WarrantyClaimsService', () => {
  function buildService(
    prisma: Record<string, unknown>,
    cache: { invalidateTag: jest.Mock } = { invalidateTag: jest.fn() },
  ) {
    return {
      service: new WarrantyClaimsService(prisma as never, cache as never),
      cache,
    };
  }

  it('rechaza reclamo sobre comprobante anulado', async () => {
    const { service } = buildService({
      saleReceiptItem: {
        findUnique: jest.fn(async () => ({
          id: 'item-1',
          warrantyEndsAt: new Date('2099-01-01'),
          receipt: { id: 'r1', voidedAt: new Date() },
        })),
      },
      $transaction: jest.fn(),
    });
    await expect(
      service.create(
        { receiptItemId: 'item-1', reportedIssue: 'No enciende la luz' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca outOfWarranty si la garantía está vencida', async () => {
    let createdData: Record<string, unknown> | null = null;
    const { service } = buildService({
      saleReceiptItem: {
        findUnique: jest.fn(async () => ({
          id: 'item-1',
          warrantyEndsAt: new Date('2020-01-01'),
          receipt: { id: 'r1', voidedAt: null },
        })),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          warrantyClaim: {
            create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
              createdData = data;
              return {
                id: 'c1',
                ...data,
                createdAt: new Date(),
                resolvedAt: null,
                deliveredAt: null,
                notes: data.notes ?? null,
                reportedIssue: data.reportedIssue,
                outOfWarranty: data.outOfWarranty,
                status: data.status,
                receiptItem: {
                  productName: 'Casio A',
                  sku: 'RM-001',
                  limitedEditionNumber: null,
                  brandName: 'Casio',
                  model: 'A',
                  receipt: {
                    id: 'r1',
                    number: 'LXT-000001',
                    customerName: 'Ana',
                    customerPhone: '300',
                    customerDocument: null,
                    saleDate: new Date(),
                    voidedAt: null,
                  },
                },
                events: [],
                createdBy: { id: 'user-1', name: 'Vendedora' },
              };
            }),
          },
        };
        return fn(tx);
      }),
    });

    const result = await service.create(
      { receiptItemId: 'item-1', reportedIssue: 'Se detiene el segundero' },
      'user-1',
    );
    expect(createdData?.outOfWarranty).toBe(true);
    expect(result.outOfWarranty).toBe(true);
  });

  it('cambio de estado crea evento y fija resolvedAt/deliveredAt', async () => {
    const eventCreate = jest.fn(async () => ({}));
    const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'c1',
      status: data.status,
      reportedIssue: 'falla',
      notes: null,
      outOfWarranty: false,
      createdAt: new Date(),
      resolvedAt: data.resolvedAt ?? null,
      deliveredAt: data.deliveredAt ?? null,
      receiptItem: {
        productName: 'Casio A',
        sku: 'RM-001',
        limitedEditionNumber: null,
        brandName: 'Casio',
        model: 'A',
        receipt: {
          id: 'r1',
          number: 'LXT-000001',
          customerName: 'Ana',
          customerPhone: null,
          customerDocument: null,
          saleDate: new Date(),
          voidedAt: null,
        },
      },
      events: [],
      createdBy: { id: 'user-1', name: 'Admin' },
    }));

    const { service, cache } = buildService({
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          warrantyClaimEvent: { create: eventCreate },
          warrantyClaim: {
            findUnique: jest.fn(async () => ({
              id: 'c1',
              status: WarrantyClaimStatus.EN_REVISION,
              replacementWatchId: null,
            })),
            update,
          },
        };
        return fn(tx);
      }),
    });

    const resolved = await service.updateStatus(
      'c1',
      { status: WarrantyClaimStatus.REPARADO },
      'user-1',
    );
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: WarrantyClaimStatus.EN_REVISION,
          toStatus: WarrantyClaimStatus.REPARADO,
        }),
      }),
    );
    expect(resolved.resolvedAt).toBeTruthy();
    expect(cache.invalidateTag).not.toHaveBeenCalled();

    const { service: deliveredService } = buildService({
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          warrantyClaimEvent: { create: eventCreate },
          warrantyClaim: {
            findUnique: jest.fn(async () => ({
              id: 'c1',
              status: WarrantyClaimStatus.REPARADO,
              replacementWatchId: null,
            })),
            update,
          },
        };
        return fn(tx);
      }),
    });
    const delivered = await deliveredService.updateStatus(
      'c1',
      { status: WarrantyClaimStatus.ENTREGADO },
      'user-1',
    );
    expect(delivered.deliveredAt).toBeTruthy();
  });

  it('REEMPLAZADO descuenta 1 unidad, guarda el SKU e invalida el catálogo', async () => {
    const order: string[] = [];
    const eventCreate = jest.fn(async () => {
      order.push('event');
      return {};
    });
    const updateMany = jest.fn(async () => {
      order.push('status');
      return { count: 1 };
    });
    const queryRaw = jest.fn(async () => {
      order.push('stock');
      return [{ id: 'w-new' }];
    });
    const { service, cache } = buildService({
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRawUnsafe: queryRaw,
          watch: {
            findFirst: jest.fn(async () => ({ id: 'w-new', sku: 'RM-9' })),
            findMany: jest.fn(async () => []),
          },
          warrantyClaimEvent: { create: eventCreate },
          warrantyClaim: {
            findUnique: jest.fn(async () => ({
              id: 'c1',
              status: WarrantyClaimStatus.EN_REVISION,
              replacementWatchId: null,
            })),
            updateMany,
            findUniqueOrThrow: jest.fn(async () =>
              detailFixture({
                replacementSku: 'RM-9',
                replacementWatch: {
                  id: 'w-new',
                  sku: 'RM-9',
                  model: 'Sub',
                  stock: 4,
                  retailPrice: 150000,
                  brand: { name: 'Casio' },
                },
                events: [
                  {
                    id: 'e1',
                    fromStatus: WarrantyClaimStatus.EN_REVISION,
                    toStatus: WarrantyClaimStatus.REEMPLAZADO,
                    note: 'Reemplazo SKU: RM-9. caja nueva',
                    createdAt: new Date('2026-01-02T00:00:00Z'),
                    createdBy: { name: 'Admin' },
                  },
                ],
              }),
            ),
          },
        };
        return fn(tx);
      }),
    });

    const result = await service.updateStatus(
      'c1',
      {
        status: WarrantyClaimStatus.REEMPLAZADO,
        replacementSku: 'rm-9',
        note: 'caja nueva',
      },
      'user-1',
    );

    expect(queryRaw).toHaveBeenCalledWith(
      expect.stringContaining('w.stock - v.qty'),
      ['w-new'],
      [1],
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1', replacementWatchId: null },
        data: expect.objectContaining({
          status: WarrantyClaimStatus.REEMPLAZADO,
          replacementWatchId: 'w-new',
          replacementSku: 'RM-9',
        }),
      }),
    );
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toStatus: WarrantyClaimStatus.REEMPLAZADO,
          note: 'Reemplazo SKU: RM-9. caja nueva',
        }),
      }),
    );
    expect(order.indexOf('stock')).toBeLessThan(order.indexOf('status'));
    expect(order.indexOf('status')).toBeLessThan(order.indexOf('event'));
    expect(result.replacementSku).toBe('RM-9');
    expect(result.replacementWatch).toEqual({
      id: 'w-new',
      sku: 'RM-9',
      brand: 'Casio',
      model: 'Sub',
      stock: 4,
      price: 150000,
    });
    expect(result.replacementWatch).not.toHaveProperty('costPrice');
    expect(result.replacementWatch).not.toHaveProperty('wholesalePrice');
    expect(cache.invalidateTag).toHaveBeenCalledTimes(1);
    expect(cache.invalidateTag).toHaveBeenCalledWith(CACHE_TAGS.catalog);
  });

  it('sin stock no cambia el estado ni invalida caché', async () => {
    const updateMany = jest.fn();
    const eventCreate = jest.fn();
    const { service, cache } = buildService({
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRawUnsafe: jest.fn(async () => []),
          watch: {
            findFirst: jest.fn(async () => ({ id: 'w-new', sku: 'RM-9' })),
            findMany: jest.fn(async () => [{ isActive: true, deletedAt: null }]),
          },
          warrantyClaimEvent: { create: eventCreate },
          warrantyClaim: {
            findUnique: jest.fn(async () => ({
              id: 'c1',
              status: WarrantyClaimStatus.EN_REVISION,
              replacementWatchId: null,
            })),
            updateMany,
          },
        };
        return fn(tx);
      }),
    });

    await expect(
      service.updateStatus(
        'c1',
        { status: WarrantyClaimStatus.REEMPLAZADO, replacementSku: 'RM-9' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
    expect(cache.invalidateTag).not.toHaveBeenCalled();
  });

  it('no vuelve a descontar si el reclamo ya tiene reloj de reemplazo', async () => {
    const queryRaw = jest.fn();
    const updateMany = jest.fn(async () => ({ count: 0 }));
    const { service, cache } = buildService({
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRawUnsafe: queryRaw,
          watch: { findFirst: jest.fn() },
          warrantyClaimEvent: { create: jest.fn() },
          warrantyClaim: {
            findUnique: jest.fn(async () => ({
              id: 'c1',
              status: WarrantyClaimStatus.EN_REVISION,
              replacementWatchId: 'w-old',
            })),
            updateMany,
          },
        };
        return fn(tx);
      }),
    });

    await expect(
      service.updateStatus(
        'c1',
        { status: WarrantyClaimStatus.REEMPLAZADO, replacementSku: 'RM-9' },
        'user-1',
      ),
    ).rejects.toThrow(/ya descontó/);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(cache.invalidateTag).not.toHaveBeenCalled();
  });

  it('exige SKU al pasar a REEMPLAZADO', async () => {
    const transaction = jest.fn();
    const { service } = buildService({ $transaction: transaction });
    await expect(
      service.updateStatus(
        'c1',
        { status: WarrantyClaimStatus.REEMPLAZADO },
        'user-1',
      ),
    ).rejects.toThrow(/SKU/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('el selector de VENDEDOR_LOCAL no devuelve costPrice ni wholesalePrice', async () => {
    const findMany = jest.fn(async () => [
      {
        id: 'w1',
        sku: 'RM-1',
        model: 'A',
        stock: 2,
        retailPrice: 100000,
        cost: 222222,
        costPrice: 222222,
        wholesalePrice: 111111,
        brand: { name: 'Casio' },
      },
    ]);
    const { service } = buildService({
      brand: {
        findMany: jest.fn(async () => [{ slug: 'casio', name: 'Casio' }]),
      },
      watch: {
        count: jest.fn(async () => 1),
        findMany,
      },
    });

    const page = await service.listReplacementWatches({ sku: 'RM-1' });
    expect(page.data).toEqual([
      {
        id: 'w1',
        sku: 'RM-1',
        brand: 'Casio',
        model: 'A',
        stock: 2,
        price: 100000,
      },
    ]);
    expect(Object.keys(page.data[0]).sort()).toEqual([
      'brand',
      'id',
      'model',
      'price',
      'sku',
      'stock',
    ]);
    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain('costPrice');
    expect(serialized).not.toContain('wholesalePrice');
    expect(serialized).not.toContain('222222');
    expect(serialized).not.toContain('111111');
    const select = (
      findMany.mock.calls as unknown as Array<[{ select: Record<string, unknown> }]>
    )[0][0].select;
    expect(select).not.toHaveProperty('cost');
    expect(select).not.toHaveProperty('costPrice');
    expect(select).not.toHaveProperty('wholesalePrice');

    const guard = new RolesGuard(new Reflector());
    expect(
      guard.canActivate(
        httpContext(
          Role.VENDEDOR_LOCAL,
          WarrantyClaimsController.prototype.listReplacementWatches,
          WarrantyClaimsController,
        ),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        httpContext(
          Role.ADMIN,
          WarrantyClaimsController.prototype.listReplacementWatches,
          WarrantyClaimsController,
        ),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        httpContext(
          Role.VENDEDOR_LOCAL,
          WatchesController.prototype.findAll,
          WatchesController,
        ),
      ),
    ).toThrow();
  });
});
