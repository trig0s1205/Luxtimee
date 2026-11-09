import { ExpenseOrigin } from '@prisma/client';
import { ExpensesService } from './expenses.service';

function expenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    name: 'Bolsas',
    description: null,
    amount: 8000,
    spentAt: new Date('2026-11-02T12:00:00.000Z'),
    origin: ExpenseOrigin.PLATAFORMA,
    createdById: null,
    createdBy: null,
    createdAt: new Date('2026-11-02T12:00:00.000Z'),
    updatedAt: new Date('2026-11-02T12:00:00.000Z'),
    ...overrides,
  };
}

describe('expenses origin', () => {
  it('persiste origin en create y lo expone en el dto', async () => {
    let stored: Record<string, unknown> | null = null;
    const prisma = {
      expense: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return expenseRow({
            name: data.name,
            description: data.description,
            amount: data.amount,
            spentAt: data.spentAt,
            origin: data.origin,
            createdById: data.createdById,
            createdBy: { id: 'u1', name: 'Admin' },
          });
        },
      },
    };
    const service = new ExpensesService(prisma as never);
    const created = await service.create(
      { name: 'Cinta', amount: 15000, origin: 'LOCAL' },
      'u1',
    );
    expect(stored).toMatchObject({ origin: ExpenseOrigin.LOCAL });
    expect(created.origin).toBe(ExpenseOrigin.LOCAL);
  });

  it('usa PLATAFORMA por defecto al crear', async () => {
    let stored: Record<string, unknown> | null = null;
    const prisma = {
      expense: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return expenseRow({
            name: data.name,
            amount: data.amount,
            spentAt: data.spentAt,
            origin: data.origin,
            createdById: data.createdById,
          });
        },
      },
    };
    const service = new ExpensesService(prisma as never);
    const created = await service.create({ name: 'Tijeras', amount: 5000 });
    expect(stored).toMatchObject({ origin: ExpenseOrigin.PLATAFORMA });
    expect(created.origin).toBe(ExpenseOrigin.PLATAFORMA);
  });

  it('findAll filtra por origin y totalsByOrigin ignora ese filtro', async () => {
    const calls: Array<{ where?: Record<string, unknown>; by?: string[] }> = [];
    const prisma = {
      expense: {
        count: async ({ where }: { where: Record<string, unknown> }) => {
          calls.push({ where });
          return 1;
        },
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          calls.push({ where });
          return [expenseRow({ origin: ExpenseOrigin.LOCAL, amount: 3000 })];
        },
        aggregate: async ({ where }: { where: Record<string, unknown> }) => {
          calls.push({ where });
          return { _sum: { amount: 3000 } };
        },
        groupBy: async ({
          where,
          by,
        }: {
          where: Record<string, unknown>;
          by: string[];
        }) => {
          calls.push({ where, by });
          return [
            { origin: ExpenseOrigin.PLATAFORMA, _sum: { amount: 10000 } },
            { origin: ExpenseOrigin.LOCAL, _sum: { amount: 3000 } },
          ];
        },
      },
    };
    const service = new ExpensesService(prisma as never);
    const result = await service.findAll({ origin: 'LOCAL' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].origin).toBe(ExpenseOrigin.LOCAL);
    expect(result.totalAmount).toBe(3000);
    expect(result.totalsByOrigin).toEqual({ PLATAFORMA: 10000, LOCAL: 3000 });

    const filteredCalls = calls.filter((call) => call.where?.origin === ExpenseOrigin.LOCAL);
    expect(filteredCalls.length).toBeGreaterThanOrEqual(3);
    const groupCall = calls.find((call) => call.by?.[0] === 'origin');
    expect(groupCall?.where?.origin).toBeUndefined();
  });

  it('summary filtra por origin y siempre incluye byOrigin del periodo', async () => {
    const groupWheres: Array<Record<string, unknown>> = [];
    const prisma = {
      expense: {
        aggregate: async () => ({ _sum: { amount: 3000 } }),
        count: async () => 1,
        findMany: async () => [expenseRow({ origin: ExpenseOrigin.LOCAL, amount: 3000 })],
        groupBy: async ({ where }: { where: Record<string, unknown> }) => {
          groupWheres.push(where);
          return [
            { origin: ExpenseOrigin.PLATAFORMA, _sum: { amount: 7000 } },
            { origin: ExpenseOrigin.LOCAL, _sum: { amount: 3000 } },
          ];
        },
      },
    };
    const service = new ExpensesService(prisma as never);
    const summary = await service.summary('month', 'LOCAL');

    expect(summary.total).toBe(3000);
    expect(summary.count).toBe(1);
    expect(summary.items[0].origin).toBe(ExpenseOrigin.LOCAL);
    expect(summary.byOrigin).toEqual({ PLATAFORMA: 7000, LOCAL: 3000 });
    expect(groupWheres[0]?.origin).toBeUndefined();
  });

  it('actualiza origin en update', async () => {
    const prisma = {
      expense: {
        findUnique: async () => expenseRow(),
        update: async ({ data }: { data: Record<string, unknown> }) =>
          expenseRow({ origin: data.origin }),
      },
    };
    const service = new ExpensesService(prisma as never);
    const updated = await service.update('e1', { origin: 'LOCAL' });
    expect(updated.origin).toBe(ExpenseOrigin.LOCAL);
  });
});
