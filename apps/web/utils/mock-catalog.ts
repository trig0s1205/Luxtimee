import type { CatalogListQuery, PaginatedResponse, WatchPublicDto } from '@luxtime/shared';
import { WatchStatus, matchesSkuSearch } from '@luxtime/shared';
import { mockWatches } from '~/mocks/watches';
import { equalsInsensitive, sanitizeCatalogQuery } from '~/utils/catalog-filters';

export function isLocalCatalogBase(base: string) {
  return /localhost|127\.0\.0\.1/i.test(base);
}

function mockToPublic(watch: (typeof mockWatches)[number]): WatchPublicDto {
  return {
    id: watch.id,
    sku: `LUX-${watch.brand.slice(0, 3).toUpperCase()}-${watch.model.slice(-3)}-MOCK`,
    slug: watch.slug,
    brand: { id: watch.brand.toLowerCase(), name: watch.brand, slug: watch.brand.toLowerCase() },
    model: watch.model,
    gender: 'Unisex',
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
    isLimitedEdition: false,
    faqs: [],
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
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const MOCK_CATALOG = mockWatches.map(mockToPublic);

export function findMockWatchBySlug(slug: string) {
  return MOCK_CATALOG.find((watch) => watch.slug === slug && watch.stock > 0);
}

export function filterMockCatalog(query: CatalogListQuery): PaginatedResponse<WatchPublicDto> {
  const params = sanitizeCatalogQuery(query);
  let data = MOCK_CATALOG.filter((watch) => watch.stock > 0);

  if (params.brand) data = data.filter((watch) => equalsInsensitive(watch.brand.slug, String(params.brand)));
  if (params.movement) data = data.filter((watch) => equalsInsensitive(watch.movementType, String(params.movement)));
  if (params.gender) data = data.filter((watch) => equalsInsensitive(watch.gender, String(params.gender)));
  if (params.available === 'true') data = data.filter((watch) => watch.stock > 0);
  if (params.available === 'false') data = data.filter((watch) => watch.stock === 0);
  if (params.minPrice !== undefined) data = data.filter((watch) => watch.retailPrice >= Number(params.minPrice));
  if (params.maxPrice !== undefined) data = data.filter((watch) => watch.retailPrice <= Number(params.maxPrice));
  if (params.search) {
    const term = String(params.search).toLowerCase();
    data = data.filter((watch) =>
      watch.model.toLowerCase().includes(term)
      || watch.slug.toLowerCase().includes(term)
      || watch.brand.name.toLowerCase().includes(term)
      || matchesSkuSearch(watch.sku, String(params.search)),
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
  return { data: data.slice(start, start + limit), total: data.length, page, limit };
}
