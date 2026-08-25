import type { BrandDto, CatalogListQuery, PaginatedResponse, WatchPublicDto } from '@luxtime/shared';
import { WatchStatus, matchesSkuSearch } from '@luxtime/shared';
import { mockWatches } from '~/mocks/watches';
import { equalsInsensitive, sanitizeCatalogQuery } from '~/utils/catalog-filters';

function mockToPublic(watch: (typeof mockWatches)[number]): WatchPublicDto {
  return {
    id: watch.id,
    sku: `LUX-${watch.brand.slice(0, 3).toUpperCase()}-${watch.model.slice(-3)}-MOCK`,
    slug: watch.slug,
    brand: { id: watch.brand.toLowerCase(), name: watch.brand, slug: watch.brand.toLowerCase() },
    model: watch.model,
    gender: undefined,
    warrantyMonths: 12,
    movementType: watch.movementType,
    functions: [],
    specs: watch.specs,
    retailPrice: watch.retailPrice,
    wholesalePrice: watch.wholesalePrice,
    stock: watch.stock,
    status: WatchStatus.DISPONIBLE,
    isActive: true,
    isPublished: true,
    showInCatalog: false,
    isLimitedEdition: false,
    images: [watch.image].filter(Boolean),
    mainImageIndex: 0,
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

function filterMockCatalog(query: CatalogListQuery): PaginatedResponse<WatchPublicDto> {
  const params = sanitizeCatalogQuery(query);
  let data = MOCK_CATALOG.filter((w) => w.stock > 0);

  if (params.brand) {
    data = data.filter((w) => equalsInsensitive(w.brand.slug, String(params.brand)));
  }
  if (params.movement) {
    data = data.filter((w) => equalsInsensitive(w.movementType, String(params.movement)));
  }
  if (params.gender) {
    data = data.filter((w) => equalsInsensitive(w.gender, String(params.gender)));
  }
  if (params.available === 'true') data = data.filter((w) => w.stock > 0);
  if (params.available === 'false') data = data.filter((w) => w.stock === 0);
  if (params.minPrice !== undefined) data = data.filter((w) => w.retailPrice >= Number(params.minPrice));
  if (params.maxPrice !== undefined) data = data.filter((w) => w.retailPrice <= Number(params.maxPrice));
  if (params.search) {
    const term = String(params.search).toLowerCase();
    data = data.filter(
      (w) =>
        w.model.toLowerCase().includes(term)
        || w.slug.toLowerCase().includes(term)
        || w.brand.name.toLowerCase().includes(term)
        || matchesSkuSearch(w.sku, String(params.search)),
    );
  }

  switch (params.sort) {
    case 'oldest':
      data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case 'price_asc':
      data.sort((a, b) => a.retailPrice - b.retailPrice);
      break;
    case 'price_desc':
      data.sort((a, b) => b.retailPrice - a.retailPrice);
      break;
    case 'newest':
    default:
      data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
  }

  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 12;
  const start = (page - 1) * limit;

  return {
    data: data.slice(start, start + limit),
    total: data.length,
    page,
    limit,
  };
}

export function useCatalogData() {
  const api = useApi();

  async function listCatalog(query: CatalogListQuery = {}) {
    const params = sanitizeCatalogQuery(query);

    try {
      return await api.get<PaginatedResponse<WatchPublicDto>>('/catalog', params);
    } catch (error) {
      if (import.meta.dev) {
        console.warn('[catalog] API fallback to mock:', error);
      }
      return filterMockCatalog(query);
    }
  }

  async function getBySlug(slug: string) {
    try {
      return await api.get<WatchPublicDto>(`/catalog/${slug}`);
    } catch {
      const found = MOCK_CATALOG.find((w) => w.slug === slug && w.stock > 0);
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

  async function getFeatured(limit = 12) {
    try {
      return await api.get<WatchPublicDto[]>('/catalog/featured', { limit });
    } catch {
      return MOCK_CATALOG.filter((w) => w.showInCatalog).slice(0, limit);
    }
  }

  async function getBestSellers(limit = 6) {
    try {
      const best = await api.get<WatchPublicDto[]>('/catalog/best-sellers', { limit });
      return best.slice(0, limit);
    } catch {
      if (import.meta.dev) return MOCK_CATALOG.slice(0, limit);
      return [];
    }
  }

  async function listWholesaleCatalog(query: CatalogListQuery = {}) {
    const params = sanitizeCatalogQuery(query);
    const baseUrl = useApiBaseUrl();
    return $fetch<PaginatedResponse<WatchPublicDto>>(`${baseUrl}/catalog/wholesale`, {
      query: params,
      credentials: 'include',
    });
  }

  async function getWholesaleBySlug(slug: string) {
    const baseUrl = useApiBaseUrl();
    return $fetch<WatchPublicDto>(`${baseUrl}/catalog/wholesale/${slug}`, {
      credentials: 'include',
    });
  }

  return {
    listCatalog,
    getBySlug,
    getNewArrivals,
    listBrands,
    getBestSellers,
    getFeatured,
    listWholesaleCatalog,
    getWholesaleBySlug,
  };
}
