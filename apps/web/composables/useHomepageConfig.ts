import { DEFAULT_HOMEPAGE_CONFIG, mergeHomepageConfig } from '~/utils/homepage-config';
import { API_TIMEOUT_MS } from '~/utils/api-timeout';

export function useHomepageConfig() {
  const baseUrl = useApiBaseUrl();

  async function fetchConfig() {
    const remote = await $fetch<Partial<import('@luxtime/shared').HomepageConfigDto>>(
      `${baseUrl}/settings/homepage/public`,
      {
        timeout: API_TIMEOUT_MS,
        cache: 'no-store',
        query: import.meta.client ? { _: Date.now() } : undefined,
        headers: import.meta.client
          ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
          : undefined,
      },
    ).catch(() => null);
    return mergeHomepageConfig(remote);
  }

  return { fetchConfig, DEFAULT_HOMEPAGE_CONFIG };
}
