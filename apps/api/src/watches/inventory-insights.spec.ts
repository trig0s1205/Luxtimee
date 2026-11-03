import { OrderStatus } from '@prisma/client';
import { WatchesRepository } from './watches.repository';

type WatchRow = {
  id: string;
  model: string;
  reference: string | null;
  stock: number;
  createdAt: Date;
  frontImageUrl: string | null;
  primaryImageUrl: string | null;
  images: string[] | null;
  brandId: string;
  isActive?: boolean;
  deletedAt?: Date | null;
};

describe('WatchesRepository.getInventoryInsights', () => {
  it('resume sin cargar todo el catálogo y tolera imágenes nulas', async () => {
    const rows: WatchRow[] = [
      {
        id: 'low',
        model: 'Sin foto',
        reference: null,
        stock: 0,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        frontImageUrl: null,
        primaryImageUrl: null,
        images: null,
        brandId: 'b1',
      },
      {
        id: 'old',
        model: 'Antiguo',
        reference: 'REF',
        stock: 3,
        createdAt: new Date('2020-01-01T00:00:00Z'),
        frontImageUrl: null,
        primaryImageUrl: null,
        images: ['old.jpg'],
        brandId: 'b1',
      },
      {
        id: 'hot',
        model: 'Vendido',
        reference: null,
        stock: 9,
        createdAt: new Date('2026-06-01T00:00:00Z'),
        frontImageUrl: 'hot.jpg',
        primaryImageUrl: null,
        images: [],
        brandId: 'missing',
      },
    ];

    const findFirst = jest.fn(async (args: {
      where?: {
        id?: string | { notIn?: string[] };
        stock?: number | { gt?: number };
      };
      orderBy?: Array<Record<string, 'asc' | 'desc'>>;
    }) => {
      let list = rows.filter((row) => row.isActive !== false && !row.deletedAt);
      const where = args.where ?? {};
      if (typeof where.id === 'string') {
        list = list.filter((row) => row.id === where.id);
      } else if (where.id?.notIn?.length) {
        const excluded = new Set(where.id.notIn);
        list = list.filter((row) => !excluded.has(row.id));
      }
      if (typeof where.stock === 'number') {
        list = list.filter((row) => row.stock === where.stock);
      } else if (where.stock && 'gt' in where.stock && where.stock.gt != null) {
        list = list.filter((row) => row.stock > (where.stock as { gt: number }).gt);
      }
      const orders = args.orderBy ?? [];
      list = [...list].sort((a, b) => {
        for (const order of orders) {
          const key = Object.keys(order)[0] as keyof WatchRow;
          const dir = order[key] === 'desc' ? -1 : 1;
          const left = a[key];
          const right = b[key];
          if (left == null || right == null) continue;
          if (left < right) return -1 * dir;
          if (left > right) return 1 * dir;
        }
        return 0;
      });
      return list[0] ?? null;
    });

    const prisma = {
      watch: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { stock: 12 },
          _count: { _all: 3 },
        }),
        count: jest.fn().mockResolvedValue(1),
        findFirst,
      },
      orderItem: {
        groupBy: jest.fn().mockResolvedValue([
          { watchId: 'hot', _sum: { quantity: 8 } },
          { watchId: 'old', _sum: { quantity: 1 } },
        ]),
      },
      brand: {
        findMany: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Rolex' }]),
      },
    };
    const repository = new WatchesRepository(prisma as never);
    const insights = await repository.getInventoryInsights();

    expect(prisma.watch.aggregate).toHaveBeenCalled();
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['watchId'],
        where: expect.objectContaining({
          order: expect.objectContaining({
            status: {
              in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO],
            },
          }),
        }),
      }),
    );
    expect(insights).toMatchObject({
      totalUnits: 12,
      totalSkus: 3,
      outOfStockCount: 1,
      lowestStock: { id: 'low', image: null, brand: 'Rolex', stock: 0 },
      highestStock: { id: 'hot', brand: '', image: 'hot.jpg', unitsSold: 8 },
      oldestInStock: { id: 'old', image: 'old.jpg', unitsSold: 1 },
      leastSold: { id: 'low', unitsSold: 0 },
      mostSold: { id: 'hot', unitsSold: 8 },
    });
  });
});
