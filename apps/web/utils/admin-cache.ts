export const ADMIN_CACHE_MS = {
  reference: 30 * 60 * 1000,
  modules: 30 * 60 * 1000,
  dashboards: 5 * 60 * 1000,
} as const;

type CacheEntry = { data: unknown; at: number };

const adminMemCache = new Map<string, CacheEntry>();

export function readAdminCache<T>(key: string, staleTime: number): T | undefined {
  const entry = adminMemCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > staleTime) {
    adminMemCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function writeAdminCache(key: string, data: unknown) {
  adminMemCache.set(key, { data, at: Date.now() });
}

export function invalidateAdminCache(key: string) {
  adminMemCache.delete(key);
}

export function invalidateAdminCachePrefix(prefix: string) {
  for (const key of adminMemCache.keys()) {
    if (key.startsWith(prefix)) adminMemCache.delete(key);
  }
}

export function clearSessionAdminCaches() {
  if (!import.meta.client) return;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(key);
  }
}

export function invalidateStaffAdminCaches() {
  invalidateAdminCachePrefix('admin-');
  invalidateAdminCachePrefix('inventory-');
  invalidateAdminCachePrefix('care');
  clearSessionAdminCaches();
}

const SESSION_PREFIX = 'lx-admin-';

export function readSessionAdminCache<T>(key: string, staleTime: number): T | undefined {
  if (!import.meta.client) return undefined;
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.at > staleTime) {
      sessionStorage.removeItem(SESSION_PREFIX + key);
      return undefined;
    }
    return entry.data as T;
  } catch {
    return undefined;
  }
}

export function writeSessionAdminCache(key: string, data: unknown) {
  if (!import.meta.client) return;
  try {
    sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify({ data, at: Date.now() }));
  } catch {}
}
