import type { AsyncDataOptions } from '#app';
import type { MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { ADMIN_CACHE_MS, readAdminCache, writeAdminCache } from '~/utils/admin-cache';

type AdminCachedOptions<T, E = T> = Omit<AsyncDataOptions<T, T, never, E>, 'getCachedData'> & {
  staleTime?: number;
};

/**
 * useAsyncData con cache en memoria (Map) para el panel admin.
 * lazy + server:false → navegación nunca bloqueada; datos cache al instante.
 */
export function useAdminCachedData<T, E = T>(
  key: MaybeRefOrGetter<string>,
  handler: () => Promise<T>,
  options?: AdminCachedOptions<T, E>,
) {
  const staleTime = options?.staleTime ?? ADMIN_CACHE_MS.modules;
  const { staleTime: _ignored, ...asyncOptions } = options ?? {};

  return useAsyncData<T>(
    key,
    async () => {
      const resolved = toValue(key);
      if (import.meta.client) {
        const hit = readAdminCache<T>(resolved, staleTime);
        if (hit !== undefined) return hit;
      }
      const result = await handler();
      if (import.meta.client) writeAdminCache(resolved, result);
      return result;
    },
    {
      lazy: true,
      server: false,
      ...asyncOptions,
      getCachedData(resolved) {
        return readAdminCache<T>(resolved, staleTime);
      },
    } as AsyncDataOptions<T>,
  );
}
