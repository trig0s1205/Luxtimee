import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrandsService } from './brands.service';

const brand = {
  id: 'brand_patek',
  name: 'PATEK PHILLIPE',
  slug: 'patek-phillipe',
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function serviceWith(prisma: Record<string, unknown>) {
  const cache = { invalidateTags: jest.fn() };
  return {
    service: new BrandsService(prisma as never, cache as never),
    cache,
  };
}

describe('BrandsService.remove', () => {
  it('elimina la marca cuando no tiene productos', async () => {
    const deleted = { ...brand };
    const prisma = {
      brand: {
        findFirst: jest.fn().mockResolvedValue(brand),
        delete: jest.fn().mockResolvedValue(deleted),
      },
      watch: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const { service } = serviceWith(prisma);

    await expect(service.remove(brand.id)).resolves.toEqual(deleted);
    expect(prisma.watch.count).toHaveBeenCalledWith({
      where: { brandId: brand.id, deletedAt: null },
    });
    expect(prisma.brand.delete).toHaveBeenCalledWith({ where: { id: brand.id } });
  });

  it('elimina la marca y los relojes ya borrados sin pedidos', async () => {
    const tx = {
      review: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      watch: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      brand: { delete: jest.fn().mockResolvedValue(brand) },
    };
    const prisma = {
      brand: { findFirst: jest.fn().mockResolvedValue(brand) },
      watch: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([{ id: 'watch_old' }]),
      },
      orderItem: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    const { service } = serviceWith(prisma);

    await service.remove(brand.id);

    expect(tx.watch.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['watch_old'] } },
    });
    expect(tx.brand.delete).toHaveBeenCalledWith({ where: { id: brand.id } });
    expect(prisma.brand.findFirst).toHaveBeenCalled();
  });

  it('archiva la marca si los relojes borrados tienen pedidos', async () => {
    const prisma = {
      brand: {
        findFirst: jest.fn().mockResolvedValue(brand),
        update: jest.fn().mockImplementation(({ data }) => ({ ...brand, ...data })),
        delete: jest.fn(),
      },
      watch: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([{ id: 'watch_sold' }]),
        deleteMany: jest.fn(),
      },
      orderItem: { count: jest.fn().mockResolvedValue(1) },
    };
    const { service } = serviceWith(prisma);

    const result = await service.remove(brand.id);

    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(prisma.brand.delete).not.toHaveBeenCalled();
    expect(prisma.watch.deleteMany).not.toHaveBeenCalled();
    expect(prisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: brand.id },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('bloquea la marca que todavía tiene relojes activos', async () => {
    const prisma = {
      brand: {
        findFirst: jest.fn().mockResolvedValue(brand),
        delete: jest.fn(),
        update: jest.fn(),
      },
      watch: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn(),
      },
    };
    const { service } = serviceWith(prisma);

    await expect(service.remove(brand.id)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove(brand.id)).rejects.toThrow(
      'No se puede eliminar: esta marca tiene 3 relojes activos.',
    );
    expect(prisma.brand.delete).not.toHaveBeenCalled();
    expect(prisma.watch.findMany).not.toHaveBeenCalled();
  });

  it('devuelve el código de Prisma cuando el borrado falla por otra causa', async () => {
    const prisma = {
      brand: {
        findFirst: jest.fn().mockResolvedValue(brand),
        delete: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('fk', {
            code: 'P2003',
            clientVersion: '6.3.1',
          }),
        ),
      },
      watch: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const { service } = serviceWith(prisma);

    await expect(service.remove(brand.id)).rejects.toThrow(/P2003/);
  });
});
