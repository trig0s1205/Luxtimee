import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  buildPosGallery,
  PosCatalogService,
  posSellableWhere,
} from './pos-catalog.service';

describe('posSellableWhere / gallery', () => {
  it('where base siempre es sellable', () => {
    expect(posSellableWhere()).toEqual({
      deletedAt: null,
      isActive: true,
      stock: { gt: 0 },
    });
  });

  it('gallery sin duplicados con imagen principal primero', () => {
    expect(
      buildPosGallery({
        images: ['a.jpg', 'b.jpg', 'a.jpg'],
        mainImageIndex: 1,
        frontImageUrl: 'b.jpg',
        primaryImageUrl: 'c.jpg',
        secondaryImageUrl: null,
        backImageUrl: 'd.jpg',
      }),
    ).toEqual(['b.jpg', 'c.jpg', 'd.jpg', 'a.jpg']);
  });
});

describe('PosCatalogService', () => {
  function build(prisma: Record<string, unknown>) {
    return new PosCatalogService(prisma as never);
  }

  it('by-sku normaliza y encuentra; stock 0 no es 404; inactivo 400', async () => {
    const findFirst = jest.fn(async ({ where }: { where: { sku: unknown } }) => {
      expect(where.sku).toEqual({ equals: 'RM-001', mode: 'insensitive' });
      return {
        id: 'w1',
        sku: 'RM-001',
        model: 'A',
        reference: null,
        limitedEditionNumber: null,
        retailPrice: 1,
        stock: 0,
        warrantyMonths: 12,
        isActive: true,
        frontImageUrl: null,
        primaryImageUrl: null,
        secondaryImageUrl: null,
        backImageUrl: null,
        images: [],
        mainImageIndex: 0,
        gender: null,
        dialColor: null,
        strapMaterial: null,
        caseMaterial: null,
        movementType: 'QUARTZ',
        createdAt: new Date(),
        brand: { name: 'Casio', slug: 'casio' },
        category: { name: 'Clásico', slug: 'clasico' },
      };
    });
    const service = build({ watch: { findFirst } });
    const dto = await service.findBySku(' rm-001 ');
    expect(dto.stock).toBe(0);
    expect(dto.sku).toBe('RM-001');

    findFirst.mockResolvedValueOnce(null);
    await expect(service.findBySku('XX-999')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    findFirst.mockResolvedValueOnce({
      id: 'w2',
      sku: 'RM-002',
      model: 'B',
      reference: null,
      limitedEditionNumber: null,
      retailPrice: 1,
      stock: 1,
      warrantyMonths: 0,
      isActive: false,
      frontImageUrl: null,
      primaryImageUrl: null,
      secondaryImageUrl: null,
      backImageUrl: null,
      images: [],
      mainImageIndex: 0,
      gender: null,
      dialColor: null,
      strapMaterial: null,
      caseMaterial: null,
      movementType: 'QUARTZ',
      createdAt: new Date(),
      brand: { name: 'Casio', slug: 'casio' },
      category: null,
    });
    await expect(service.findBySku('RM-002')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('catalog: min>max 400; select sin cost; hasMore', async () => {
    const service = build({
      watch: {
        count: jest.fn(async () => 25),
        findMany: jest.fn(async ({ select }: { select: Record<string, unknown> }) => {
          const keys = JSON.stringify(select);
          expect(keys).not.toContain('cost');
          expect(keys).not.toContain('profitPercent');
          return [];
        }),
      },
    });
    await expect(
      service.listCatalog({ minPrice: 10, maxPrice: 5 }),
    ).rejects.toThrow(/precio mínimo/i);

    const page = await service.listCatalog({ page: 1, limit: 24 });
    expect(page.hasMore).toBe(true);
  });
});
