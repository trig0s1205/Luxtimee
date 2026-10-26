import type { BrandDto, CatalogListQuery, PaginatedResponse, WatchPublicDto } from '@luxtime/shared';
import { API_TIMEOUT_MS } from '~/utils/api-timeout';
import { sanitizeCatalogQuery } from '~/utils/catalog-filters';
import { filterMockCatalog, findMockWatchBySlug, isLocalCatalogBase } from '~/utils/mock-catalog';

function errorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return 0;
  const row = error as { statusCode?: number; status?: number };
  return row.statusCode || row.status || 0;
}

export function useCatalogData() {
  const api = useApi();
  const mockOk = import.meta.dev || isLocalCatalogBase(useApiBaseUrl());

  async function listCatalog(query: CatalogListQuery = {}) {
    const params = sanitizeCatalogQuery(query);

    try {
      return await api.get<PaginatedResponse<WatchPublicDto>>('/catalog', params);
    } catch (error) {
      if (!mockOk) throw error;
      if (import.meta.dev) console.warn('[catalog] API fallback to mock:', error);
      return filterMockCatalog(query);
    }
  }

  async function getBySlug(slug: string) {
    try {
      return await api.get<WatchPublicDto>(`/catalog/${slug}`);
    } catch (error) {
      if (mockOk) {
        const found = findMockWatchBySlug(slug);
        if (found) return found;
      }
      if (errorStatus(error) === 404) {
        throw createError({ statusCode: 404, message: 'Producto no encontrado' });
      }
      throw error;
    }
  }

  async function getNewArrivals() {
    try {
      return await api.get<WatchPublicDto[]>('/catalog/new-arrivals');
    } catch (error) {
      if (!mockOk) throw error;
      return filterMockCatalog({ limit: 4 }).data;
    }
  }

  async function listBrands() {
    try {
      return await api.get<BrandDto[]>('/brands/public');
    } catch {
      const brands = new Map<string, BrandDto>();
      for (const w of filterMockCatalog({ limit: 100 }).data) brands.set(w.brand.slug, w.brand);
      return [...brands.values()];
    }
  }

  async function getBestSellers(limit = 6) {
    try {
      const best = await api.get<WatchPublicDto[]>('/catalog/best-sellers', { limit });
      return best.slice(0, limit);
    } catch (error) {
      if (mockOk) return filterMockCatalog({ limit }).data.slice(0, limit);
      throw error;
    }
  }

  async function listWholesaleCatalog(query: CatalogListQuery = {}) {
    const params = sanitizeCatalogQuery(query);
    const baseUrl = useApiBaseUrl();
    return apiFetch<PaginatedResponse<WatchPublicDto>>(`${baseUrl}/catalog/wholesale`, {
      query: params,
      credentials: 'include',
      timeout: API_TIMEOUT_MS,
    });
  }

  async function getWholesaleBySlug(slug: string) {
    const baseUrl = useApiBaseUrl();
    return apiFetch<WatchPublicDto>(`${baseUrl}/catalog/wholesale/${slug}`, {
      credentials: 'include',
      timeout: API_TIMEOUT_MS,
    });
  }

  return {
    listCatalog,
    getBySlug,
    getNewArrivals,
    listBrands,
    getBestSellers,
    listWholesaleCatalog,
    getWholesaleBySlug,
  };
}
