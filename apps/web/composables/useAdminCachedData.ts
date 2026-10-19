import type { AsyncDataOptions } from '#app';
import type { MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { ADMIN_CACHE_MS, invalidateAdminCache, readAdminCache, writeAdminCache } from '~/utils/admin-cache';
import { resolveAccessToken } from '~/utils/auth-token';

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
  let bypassCache = false;

  const result = useAsyncData<T>(
    key,
    async () => {
      const resolved = toValue(key);
      if (import.meta.client) {
        const auth = useAuthStore();
        auth.hydrateTokens();
        if (auth.isStaff && !auth.isLocalSession && !resolveAccessToken(auth.accessToken)) {
          try {
            await auth.ensureAccessToken();
          } catch {
            throw createError({ statusCode: 401, statusMessage: 'Sesión expirada' });
          }
        }
        if (!bypassCache) {
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
      dedupe: 'defer',
      ...asyncOptions,
      getCachedData(resolved) {
        if (bypassCache) return undefined;
        return readAdminCache<T>(resolved, staleTime);
      },
    } as AsyncDataOptions<T>,
  );

  async function refreshFromNetwork() {
    bypassCache = true;
    invalidateAdminCache(toValue(key));
    try {
      await result.refresh();
    } finally {
      bypassCache = false;
    }
  }

  return {
    ...result,
    refresh: refreshFromNetwork,
  };
}
