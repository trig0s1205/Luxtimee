import { API_TIMEOUT_MS } from '~/utils/api-timeout';

type QueryValue = string | number | boolean | undefined;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  _retried?: boolean;
};

function isUnauthorized(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { statusCode?: number; status?: number }).statusCode
    ?? (err as { status?: number }).status;
  return status === 401;
}

let refreshPromise: Promise<void> | null = null;

export function useApi() {
  const baseUrl = useApiBaseUrl();

  async function refreshSession() {
    const auth = useAuthStore();
    if (!refreshPromise) {
      refreshPromise = auth.refreshSession().finally(() => {
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
      const response = await apiFetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        body: options.body as Record<string, unknown> | BodyInit | null | undefined,
        query: options.query,
        credentials: 'include',
        timeout: API_TIMEOUT_MS,
      });
      return response as T;
    } catch (err: unknown) {
      if (isUnauthorized(err) && !options._retried) {
        try {
          await refreshSession();
          return request<T>(path, { ...options, _retried: true });
        } catch {
          /* refresh falló */
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
