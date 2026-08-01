import type { AsyncDataOptions } from '#app';
import type { MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import {
  hasHydratedCacheKey,
  markHydratedCacheKey,
  readClientCache,
  STOREFRONT_CACHE_MS,
  writeClientCache,
} from '~/utils/storefront-cache';

type CachedAsyncDataOptions<T, E = T> = Omit<
  AsyncDataOptions<T, T, never, E>,
  'getCachedData'
> & {
  staleTime?: number;
};

/**
 * Extiende useAsyncData con TTL en cliente sin reemplazar el payload cache de Nuxt.
 */
export function useCachedAsyncData<T, E = T>(
  key: MaybeRefOrGetter<string>,
  handler: () => Promise<T>,
  options?: CachedAsyncDataOptions<T, E>,
) {
  const staleTime = options?.staleTime ?? STOREFRONT_CACHE_MS.catalog;
  const { staleTime: _ignored, ...asyncOptions } = options ?? {};

  return useAsyncData<T>(
    key,
    async () => {
      const resolved = toValue(key);
      if (import.meta.client) {
        const hit = readClientCache<T>(resolved, staleTime);
        if (hit !== undefined) return hit;
      }
      const result = await handler();
      if (import.meta.client) writeClientCache(resolved, result);
      return result;
    },
    {
      ...asyncOptions,
      getCachedData(resolved, nuxtApp) {
        const fresh = readClientCache<T>(resolved, staleTime);
        if (fresh !== undefined) return fresh;

        if (!hasHydratedCacheKey(resolved)) {
          const payload = nuxtApp.payload.data[resolved] ?? nuxtApp.static.data[resolved];
          if (payload !== undefined) {
            writeClientCache(resolved, payload);
            markHydratedCacheKey(resolved);
            return payload as T;
          }
        }
      },
    } as AsyncDataOptions<T>,
  );
}
