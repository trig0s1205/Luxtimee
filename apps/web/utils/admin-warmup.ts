import { ADMIN_CACHE_MS, readAdminCache, writeAdminCache } from '~/utils/admin-cache';

type ApiClient = {
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>) => Promise<T>;
};

const WARMUP_ENTRIES: Array<{
  key: string;
  fetch: (api: ApiClient) => Promise<unknown>;
}> = [
  {
    key: 'admin-watches--1',
    fetch: (api) => api.get('/watches', { page: 1, limit: 30 }).catch(() => ({ data: [], total: 0, page: 1, limit: 30 })),
  },
  {
    key: 'inventory-insights',
    fetch: (api) => api.get('/watches/inventory-insights').catch(() => null),
  },
  {
    key: 'admin-pre-orders-active-1',
    fetch: (api) => api.get('/pre-orders', { page: 1, limit: 10 }).catch(() => ({ items: [], total: 0, page: 1, limit: 10 })),
  },
  {
    key: 'admin-pre-orders-suspended-1',
    fetch: (api) => api.get('/pre-orders/suspended', { page: 1, limit: 10 }).catch(() => ({ items: [], total: 0, page: 1, limit: 10 })),
  },
  {
    key: 'admin-orders-detal-day-ALL-1',
    fetch: (api) => api.get('/orders?period=day&page=1&limit=15&type=DETAL').catch(() => ({ items: [], total: 0, page: 1, limit: 15 })),
  },
  {
    key: 'admin-orders-mayorista-day-ALL-1',
    fetch: (api) => api.get('/orders?period=day&page=1&limit=15&type=MAYORISTA').catch(() => ({ items: [], total: 0, page: 1, limit: 15 })),
  },
  {
    key: 'admin-zones',
    fetch: (api) => api.get('/shipping-zones').catch(() => []),
  },
  {
    key: 'notifications',
    fetch: (api) => api.get('/notifications').catch(() => []),
  },
  {
    key: 'health-dashboard',
    fetch: (api) => api.get('/dashboards/health?period=month').catch(() => null),
  },
];

export function warmupAdminModules(api: ApiClient) {
  if (!import.meta.client) return;

  for (const { key, fetch } of WARMUP_ENTRIES) {
    if (readAdminCache(key, ADMIN_CACHE_MS.modules) !== undefined) continue;
    void fetch(api).then((data) => {
      if (data !== null && data !== undefined) writeAdminCache(key, data);
    });
  }
}
