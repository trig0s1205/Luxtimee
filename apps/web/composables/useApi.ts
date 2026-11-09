import { API_TIMEOUT_MS } from '~/utils/api-timeout';
import {
  isTransientRequestError,
  isUnauthorizedError,
} from '~/utils/api-error-kind';

type QueryValue = string | number | boolean | undefined;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  _retried?: boolean;
};

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
        signal: options.signal,
        credentials: 'include',
        timeout: API_TIMEOUT_MS,
      });
      return response as T;
    } catch (err: unknown) {
      if (isUnauthorizedError(err) && !options._retried) {
        try {
          await refreshSession();
          return request<T>(path, { ...options, _retried: true });
        } catch (refreshErr) {
          // Red/5xx en el refresh: no borrar sesión; solo falla la petición.
          if (isTransientRequestError(refreshErr)) throw refreshErr;
          throw err;
        }
      }
      throw err;
    }
  }

  async function postBlob(path: string, body?: unknown, retried = false): Promise<Blob> {
    const auth = useAuthStore();
    if (auth.isLocalSession) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Sesión local sin acceso al API. Cierra sesión e ingresa de nuevo.',
      });
    }
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/pdf' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      if (response.status === 401 && !retried) {
        try {
          await refreshSession();
          return postBlob(path, body, true);
        } catch (refreshErr) {
          if (isTransientRequestError(refreshErr)) throw refreshErr;
          throw createError({ statusCode: 401, statusMessage: 'No autorizado' });
        }
      }
      if (!response.ok) {
        let message = 'No se pudo generar el archivo';
        try {
          const data = await response.json() as { message?: string | string[] };
          if (typeof data.message === 'string') message = data.message;
          else if (Array.isArray(data.message)) message = data.message.join(', ');
        } catch {
          /* ignore */
        }
        throw createError({ statusCode: response.status, statusMessage: message });
      }
      return response.blob();
    } catch (err: unknown) {
      if (isUnauthorizedError(err) && !retried) {
        try {
          await refreshSession();
          return postBlob(path, body, true);
        } catch (refreshErr) {
          if (isTransientRequestError(refreshErr)) throw refreshErr;
          throw err;
        }
      }
      throw err;
    }
  }

  return {
    get: <T>(path: string, query?: Record<string, QueryValue>, init?: { signal?: AbortSignal }) =>
      request<T>(path, { query, signal: init?.signal }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    postBlob,
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    refreshSession,
  };
}
