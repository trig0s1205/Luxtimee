/** TTL del cliente alineado con la cache pública del API. */
export const STOREFRONT_CACHE_MS = {
  static: 10 * 60 * 1000,
  catalog: 2 * 60 * 1000,
  product: 3 * 60 * 1000,
} as const;

type CacheEntry = { data: unknown; at: number };

const clientStore = new Map<string, CacheEntry>();
const hydratedKeys = new Set<string>();

export function readClientCache<T>(key: string, staleTime: number): T | undefined {
  const entry = clientStore.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > staleTime) {
    clientStore.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function writeClientCache(key: string, data: unknown) {
  clientStore.set(key, { data, at: Date.now() });
  hydratedKeys.add(key);
}

export function hasHydratedCacheKey(key: string) {
  return hydratedKeys.has(key);
}

export function markHydratedCacheKey(key: string) {
  hydratedKeys.add(key);
}

export function invalidateClientCache(key: string) {
  clientStore.delete(key);
  hydratedKeys.delete(key);
}
