type QueryValue = string | number | boolean | undefined;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  _retried?: boolean;
};

function isUnauthorized(err: unknown) {
  return err
    && typeof err === 'object'
    && 'statusCode' in err
    && (err as { statusCode?: number }).statusCode === 401;
}

let refreshPromise: Promise<void> | null = null;

export function useApi() {
  const baseUrl = useApiBaseUrl();

  async function refreshSession() {
    if (!refreshPromise) {
      refreshPromise = $fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(() => undefined)
        .finally(() => {
          refreshPromise = null;
        });
    }
    await refreshPromise;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const auth = useAuthStore();

    if (auth.isLocalSession) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Sesión local sin acceso al API. Cierra sesión e ingresa de nuevo.',
      });
    }

    try {
      const response = await $fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        body: options.body as Record<string, unknown> | BodyInit | null | undefined,
        query: options.query,
        credentials: 'include',
      });
      return response as T;
    } catch (err: unknown) {
      if (isUnauthorized(err) && !options._retried && auth.isAuthenticated) {
        try {
          await refreshSession();
          return request<T>(path, { ...options, _retried: true });
        } catch {
          await auth.logout();
          if (import.meta.client) {
            const route = useRoute();
            if (route.path.startsWith('/admin')) {
              await navigateTo('/vigilancia', { replace: true });
            } else {
              const { loginPath } = useStaffLoginPath();
              await navigateTo(loginPath({ redirect: route.fullPath }));
            }
          }
        }
      }
      throw err;
    }
  }

  return {
    get: <T>(path: string, query?: Record<string, QueryValue>) => request<T>(path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    refreshSession,
  };
}
