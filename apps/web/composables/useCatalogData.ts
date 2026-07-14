import type { BrandDto, PaginatedResponse, WatchPublicDto } from '@luxtime/shared';
import { mockWatches } from '~/mocks/watches';

function mockToPublic(watch: (typeof mockWatches)[number]): WatchPublicDto {
  return {
    id: watch.id,
    slug: watch.slug,
    brand: { id: watch.brand.toLowerCase(), name: watch.brand, slug: watch.brand.toLowerCase() },
    model: watch.model,
    movementType: watch.movementType,
    specs: watch.specs,
    retailPrice: watch.retailPrice,
    wholesalePrice: watch.wholesalePrice,
    stock: watch.stock,
    isActive: true,
    frontImageUrl: watch.image,
    backImageUrl: null,
    warrantyTemplate: {
      id: 'mock-warranty',
      name: 'Garantía estándar',
      durationMonths: 12,
      terms: watch.warranty,
    },
    careTemplate: {
      id: 'mock-care',
      name: 'Cuidados',
      instructions: watch.care,
    },
    createdAt: new Date().toISOString(),
  };
}

const MOCK_CATALOG = mockWatches.map(mockToPublic);

export function useCatalogData() {
  const api = useApi();

  async function listCatalog(query: Record<string, string | number | boolean | undefined> = {}) {
    try {
      return await api.get<PaginatedResponse<WatchPublicDto>>('/catalog', query);
    } catch {
      let data = [...MOCK_CATALOG];
      if (query.brand) {
        data = data.filter((w) => w.brand.slug === String(query.brand));
      }
      if (query.movement) {
        data = data.filter((w) => w.movementType === String(query.movement));
      }
      if (query.available === 'true') data = data.filter((w) => w.stock > 0);
      if (query.available === 'false') data = data.filter((w) => w.stock === 0);
      return { data, total: data.length, page: 1, limit: data.length };
    }
  }

  async function getBySlug(slug: string) {
    try {
      return await api.get<WatchPublicDto>(`/catalog/${slug}`);
    } catch {
      const found = MOCK_CATALOG.find((w) => w.slug === slug);
      if (!found) throw createError({ statusCode: 404, message: 'Producto no encontrado' });
      return found;
    }
  }

  async function getNewArrivals() {
    try {
      return await api.get<WatchPublicDto[]>('/catalog/new-arrivals');
    } catch {
      return MOCK_CATALOG.slice(0, 4);
    }
  }

  async function listBrands() {
    try {
      return await api.get<BrandDto[]>('/brands/public');
    } catch {
      const brands = new Map<string, BrandDto>();
      for (const w of MOCK_CATALOG) brands.set(w.brand.slug, w.brand);
      return [...brands.values()];
    }
  }

  return { listCatalog, getBySlug, getNewArrivals, listBrands };
}
