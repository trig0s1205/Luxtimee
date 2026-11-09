import { BadRequestException } from '@nestjs/common';
import { WarrantyClaimStatus } from '@prisma/client';
import {
  buildReceiptSearchWhere,
  normalizeReceiptNumberQuery,
} from '../receipts/receipt-search.util';
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

describe('WarrantyClaimsService', () => {
  function buildService(prisma: Record<string, unknown>) {
    return new WarrantyClaimsService(prisma as never);
  }

  it('rechaza reclamo sobre comprobante anulado', async () => {
    const service = buildService({
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
    const service = buildService({
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

    const service = buildService({
      warrantyClaim: {
        findUnique: jest.fn(async () => ({
          id: 'c1',
          status: WarrantyClaimStatus.EN_REVISION,
        })),
        update,
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          warrantyClaimEvent: { create: eventCreate },
          warrantyClaim: { update },
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

    const deliveredService = buildService({
      warrantyClaim: {
        findUnique: jest.fn(async () => ({
          id: 'c1',
          status: WarrantyClaimStatus.REPARADO,
        })),
        update,
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          warrantyClaimEvent: { create: eventCreate },
          warrantyClaim: { update },
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
});
