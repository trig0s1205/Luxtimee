import type { AsyncDataOptions } from '#app';
import type { MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { ADMIN_CACHE_MS, invalidateAdminCache, readAdminCache, writeAdminCache } from '~/utils/admin-cache';

type AdminCachedOptions<T, E = T> = Omit<AsyncDataOptions<T, T, never, E>, 'getCachedData'> & {
  staleTime?: number;
};

/**
 * useAsyncData con cache en memoria (Map) para el panel admin.
 * lazy + server:false → navegación nunca bloqueada; datos cache al instante.
 * `refresh()` invalida la cache y vuelve a pedir al API.
 */
export function useAdminCachedData<T, E = T>(
  key: MaybeRefOrGetter<string>,
  handler: () => Promise<T>,
  options?: AdminCachedOptions<T, E>,
) {
  const staleTime = options?.staleTime ?? ADMIN_CACHE_MS.modules;
  const { staleTime: _ignored, ...asyncOptions } = options ?? {};
  let forceNetwork = 0;

  const result = useAsyncData<T>(
    key,
    async () => {
      const resolved = toValue(key);
      const skipCache = forceNetwork > 0;
      if (import.meta.client) {
        const auth = useAuthStore();
        auth.hydrateTokens();
        if (!skipCache) {
          const hit = readAdminCache<T>(resolved, staleTime);
          if (hit !== undefined) return hit;
        }
      }
      const data = await handler();
      if (import.meta.client) writeAdminCache(resolved, data);
      return data;
    },
    {
      lazy: true,
      server: false,
      ...asyncOptions,
      dedupe: 'cancel',
      getCachedData(resolved) {
        if (forceNetwork > 0) return undefined;
        return readAdminCache<T>(resolved, staleTime);
      },
    } as AsyncDataOptions<T>,
  );

  async function refreshFromNetwork() {
    forceNetwork += 1;
    invalidateAdminCache(toValue(key));
    try {
      await result.refresh({ dedupe: 'cancel' });
    } finally {
      forceNetwork -= 1;
    }
  }

  return {
    ...result,
    refresh: refreshFromNetwork,
  };
}
