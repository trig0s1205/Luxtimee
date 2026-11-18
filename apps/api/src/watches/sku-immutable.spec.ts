import { Role } from '@prisma/client';
import { WatchesService } from './watches.service';
import { ProductsService } from '../products/products.service';

describe('SKU inmutable', () => {
  it('WatchesService.update no escribe sku aunque cambien precio y género', async () => {
    const update = jest.fn(async (_id: string, data: Record<string, unknown>) => ({
      id: 'w1',
      sku: 'RM-001',
      ...data,
    }));
    const existing = {
      id: 'w1',
      sku: 'RM-001',
      retailPrice: 50_000,
      wholesalePrice: 40_000,
      cost: 20_000,
      gender: 'Hombre',
      stock: 1,
      status: 'DISPONIBLE',
      isActive: true,
      isPublished: true,
      deletedAt: null,
      model: 'A',
      brandId: 'b1',
      categoryId: null,
      mechanismId: null,
      warrantyTemplateId: null,
      careTemplateId: null,
      description: 'ok',
      images: ['a.jpg'],
      frontImageUrl: 'a.jpg',
      primaryImageUrl: 'a.jpg',
      secondaryImageUrl: null,
      backImageUrl: null,
      videoUrl: 'v.mp4',
      draftReady: true,
      caseMaterial: null,
      dialColor: null,
      strapMaterial: null,
      movementType: 'Cuarzo',
      reference: null,
      limitedEditionNumber: null,
      warrantyMonths: 12,
      mainImageIndex: 0,
      faqItems: [],
      isDraft: false,
    };
    const repo = {
      findById: jest.fn(async () => existing),
      update,
      allocateReplacementSku: jest.fn(),
    };
    const service = new WatchesService(
      repo as never,
      {
        getCommissionConfig: async () => ({ percent: 5 }),
      } as never,
      {} as never,
      { invalidateTag: () => undefined } as never,
    );
    await service.update(
      'w1',
      { retailPrice: 150_000, gender: 'Mujer' } as never,
      Role.SUPER_ADMIN,
    );
    expect(repo.allocateReplacementSku).not.toHaveBeenCalled();
    const data = update.mock.calls[0][1];
    expect(data).not.toHaveProperty('sku');
  });

  it('ProductsService.update no escribe sku aunque cambie retailPrice', async () => {
    const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'w1',
      sku: 'RM-001',
      retailPrice: 150_000,
      brand: { name: 'Casio' },
      warrantyTemplate: null,
      careTemplate: null,
      ...data,
    }));
    const existing = {
      id: 'w1',
      sku: 'RM-001',
      retailPrice: 50_000,
      wholesalePrice: 40_000,
      cost: 20_000,
      gender: 'Hombre',
      stock: 1,
      isActive: true,
      deletedAt: null,
      model: 'A',
      brandId: 'b1',
    };
    const prisma = {
      watch: {
        findUnique: jest.fn(async () => existing),
        update,
      },
    };
    const watchesRepository = {
      allocateReplacementSku: jest.fn(),
    };
    const service = new ProductsService(
      prisma as never,
      watchesRepository as never,
    );
    await service.update(
      'w1',
      { retailPrice: 150_000 } as never,
      Role.SUPER_ADMIN,
    );
    expect(watchesRepository.allocateReplacementSku).not.toHaveBeenCalled();
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty('sku');
  });
});
