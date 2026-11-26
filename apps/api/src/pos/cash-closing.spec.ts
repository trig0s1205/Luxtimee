import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentMethod, Prisma, Role } from '@prisma/client';
import { expectedDrawerCash } from '@luxtime/shared';
import { todayBogotaYmd } from '../receipts/bogota-time.util';
import { renderCashClosingPdf } from './cash-closing-pdf';
import { PosService } from './pos.service';

function buildService(prisma: Record<string, unknown>) {
  return new PosService(
    prisma as never,
    {} as never,
    {} as never,
    { emit: jest.fn() } as never,
    { invalidateTag: jest.fn() } as never,
    {} as never,
  );
}

describe('POS cash closing', () => {
  const seller = { id: 'u1', role: Role.VENDEDOR_LOCAL } as const;
  const admin = { id: 'admin1', role: Role.ADMIN } as const;
  const today = todayBogotaYmd();

  it('preview suma métodos y marca alreadyClosed', async () => {
    const paidAt = new Date(`${today}T15:00:00.000Z`);
    const prisma = {
      orderPayment: {
        findMany: async () => [
          {
            amount: 40_000,
            method: PaymentMethod.EFECTIVO,
            paidAt,
            order: {
              id: 'o1',
              readableId: 'LX-1',
              customerName: 'Ana',
              total: 100_000,
            },
          },
          {
            amount: 60_000,
            method: PaymentMethod.TRANSFERENCIA,
            paidAt,
            order: {
              id: 'o1',
              readableId: 'LX-1',
              customerName: 'Ana',
              total: 100_000,
            },
          },
          {
            amount: 20_000,
            method: PaymentMethod.DATAFONO_BOLD,
            paidAt,
            order: {
              id: 'o2',
              readableId: 'LX-2',
              customerName: 'Luis',
              total: 20_000,
            },
          },
        ],
      },
      cashClosing: {
        findUnique: async () => null,
      },
      expense: { findMany: async () => [] },
    };

    const preview = await buildService(prisma).cashClosingPreview(
      today,
      admin as never,
    );
    expect(preview.totalCash).toBe(40_000);
    expect(preview.totalTransfer).toBe(60_000);
    expect(preview.totalCard).toBe(20_000);
    expect(preview.totalSales).toBe(120_000);
    expect(preview.salesCount).toBe(2);
    expect(preview.alreadyClosed).toBe(false);
    expect(preview.closing).toBeNull();
  });

  it('createCashClosing calcula expectedCash y difference', async () => {
    let stored: Record<string, unknown> | null = null;
    const prisma = {
      orderPayment: {
        findMany: async () => [
          {
            amount: 50_000,
            method: PaymentMethod.EFECTIVO,
            paidAt: new Date(`${today}T15:00:00.000Z`),
            order: {
              id: 'o1',
              readableId: 'LX-1',
              customerName: 'Ana',
              total: 50_000,
            },
          },
        ],
      },
      cashClosing: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return {
            id: 'c1',
            ...data,
            notes: data.notes ?? null,
            createdAt: new Date(`${today}T20:00:00.000Z`),
            user: { name: 'Vendedor' },
          };
        },
      },
      expense: {
        findMany: async () => [
          {
            id: 'g1',
            name: 'Domicilio',
            description: null,
            amount: 10_000,
            spentAt: new Date(`${today}T12:00:00.000Z`),
            createdAt: new Date(`${today}T16:00:00.000Z`),
            createdBy: { name: 'Ana' },
          },
        ],
      },
    };

    const result = await buildService(prisma).createCashClosing(
      {
        date: today,
        openingCash: 100_000,
        countedCash: 140_000,
        notes: 'cuadró con la salida',
      },
      admin as never,
    );

    expect(expectedDrawerCash(100_000, 50_000, 10_000)).toBe(140_000);
    expect(stored).toMatchObject({
      openingCash: 100_000,
      countedCash: 140_000,
      expectedCash: 140_000,
      difference: 0,
      cashOutTotal: 10_000,
      totalCash: 50_000,
      userId: 'admin1',
    });
    expect(result.difference).toBe(0);
    expect(result.expectedCash).toBe(140_000);
  });

  it('exige nota si la diferencia no es cero', async () => {
    const prisma = {
      orderPayment: { findMany: async () => [] },
      expense: { findMany: async () => [] },
      cashClosing: { create: async () => { throw new Error('no debe guardar'); } },
    };
    await expect(
      buildService(prisma).createCashClosing(
        { date: today, openingCash: 0, countedCash: 5_000, notes: 'ok' },
        admin as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('createCashClosing duplicado → ConflictException', async () => {
    const prisma = {
      orderPayment: { findMany: async () => [] },
      expense: { findMany: async () => [] },
      cashClosing: {
        create: async () => {
          throw new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'test',
          });
        },
      },
    };
    await expect(
      buildService(prisma).createCashClosing(
        { date: today, openingCash: 0, countedCash: 0 },
        admin as never,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('VENDEDOR_LOCAL no puede consultar fechas antiguas', async () => {
    const prisma = {
      orderPayment: { findMany: async () => [] },
      expense: { findMany: async () => [] },
      cashClosing: { findUnique: async () => null },
    };
    await expect(
      buildService(prisma).cashClosingPreview('2020-01-01', seller as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ADMIN puede consultar cualquier fecha', async () => {
    const prisma = {
      orderPayment: { findMany: async () => [] },
      expense: { findMany: async () => [] },
      cashClosing: { findUnique: async () => null },
    };
    const preview = await buildService(prisma).cashClosingPreview(
      '2020-01-01',
      admin as never,
    );
    expect(preview.date).toBe('2020-01-01');
    expect(preview.alreadyClosed).toBe(false);
  });

  it('cierre guardado no se recalcula si hay anulaciones posteriores', async () => {
    const existing = {
      id: 'c1',
      businessDate: new Date(`${today}T00:00:00.000Z`),
      userId: 'u1',
      openingCash: 10_000,
      countedCash: 60_000,
      expectedCash: 60_000,
      difference: 0,
      totalCash: 50_000,
      totalTransfer: 0,
      totalCard: 0,
      totalOther: 0,
      totalSales: 50_000,
      salesCount: 1,
      notes: null,
      cashOutTotal: null,
      createdAt: new Date(`${today}T20:00:00.000Z`),
      user: { name: 'Vendedor' },
    };
    const prisma = {
      orderPayment: {
        findMany: async () => [],
      },
      expense: { findMany: async () => [] },
      cashClosing: {
        findUnique: async () => existing,
      },
    };
    const preview = await buildService(prisma).cashClosingPreview(
      today,
      admin as never,
    );
    expect(preview.alreadyClosed).toBe(true);
    expect(preview.closing?.totalCash).toBe(50_000);
    expect(preview.closing?.expectedCash).toBe(60_000);
    expect(preview.totalCash).toBe(0);
  });

  it('el PDF del cierre cabe en una página', async () => {
    const buffer = await renderCashClosingPdf({
      id: 'c1',
      businessDate: today,
      userId: 'admin1',
      userName: 'Admin',
      openingCash: 1000,
      countedCash: 800,
      expectedCash: 900,
      difference: -100,
      totalCash: 400,
      totalTransfer: 200,
      totalCard: 100,
      totalOther: 0,
      totalSales: 700,
      salesCount: 2,
      cashOutTotal: 500,
      notes: 'Faltó el cambio de un billete',
      createdAt: new Date().toISOString(),
    });
    const text = buffer.toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)?.length).toBe(1);
  });
});
