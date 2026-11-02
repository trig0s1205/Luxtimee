import { ExpensesService, expenseDate } from './expenses.service';

describe('gastos', () => {
  it('rechaza nombre vacío y valor en cero', async () => {
    const service = new ExpensesService({} as never);
    await expect(
      service.create({ name: '   ', amount: 1000 }),
    ).rejects.toThrow(/nombre/i);
    await expect(
      service.create({ name: 'Tijeras', amount: 0 }),
    ).rejects.toThrow(/mayor a 0/);
  });

  it('guarda el gasto con la fecha indicada', async () => {
    let stored: Record<string, unknown> | null = null;
    const prisma = {
      expense: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return {
            id: 'e1',
            name: data.name,
            description: data.description,
            amount: data.amount,
            spentAt: data.spentAt,
            createdById: data.createdById,
            createdBy: { id: 'u1', name: 'Admin' },
            createdAt: new Date('2026-11-02T12:00:00.000Z'),
            updatedAt: new Date('2026-11-02T12:00:00.000Z'),
          };
        },
      },
    };
    const service = new ExpensesService(prisma as never);
    const created = await service.create(
      { name: 'Cinta', description: 'embalaje', amount: 15000, spentAt: '2026-11-01' },
      'u1',
    );
    expect(stored).toMatchObject({
      name: 'Cinta',
      description: 'embalaje',
      amount: 15000,
      createdById: 'u1',
    });
    expect(expenseDate('2026-11-01').toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(created.amount).toBe(15000);
    expect(created.createdByName).toBe('Admin');
  });

  it('el resumen suma solo el periodo', async () => {
    const rows = [
      {
        id: 'e1',
        name: 'Bolsas',
        description: null,
        amount: 8000,
        spentAt: new Date('2026-11-02T12:00:00.000Z'),
        createdById: null,
        createdBy: null,
        createdAt: new Date('2026-11-02T12:00:00.000Z'),
        updatedAt: new Date('2026-11-02T12:00:00.000Z'),
      },
    ];
    const prisma = {
      expense: {
        aggregate: async () => ({ _sum: { amount: 8000 } }),
        count: async () => 1,
        findMany: async () => rows,
      },
    };
    const service = new ExpensesService(prisma as never);
    const summary = await service.summary('month');
    expect(summary.total).toBe(8000);
    expect(summary.count).toBe(1);
    expect(summary.items[0].name).toBe('Bolsas');
  });
});
