type QueryValue = string | number | boolean | undefined;

export function useApi() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBaseUrl as string;

  async function request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: unknown;
      query?: Record<string, QueryValue>;
    } = {},
  ): Promise<T> {
    return $fetch<T>(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      body: options.body,
      query: options.query,
      credentials: 'include',
    });
  }

  return {
    get: <T>(path: string, query?: Record<string, QueryValue>) => request<T>(path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}
