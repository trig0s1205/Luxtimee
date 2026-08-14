import { DEFAULT_HOMEPAGE_CONFIG, mergeHomepageConfig } from '~/utils/homepage-config';

export { DEFAULT_HOMEPAGE_CONFIG };

export function useHomepageConfig() {
  const baseUrl = useApiBaseUrl();

  async function fetchConfig() {
    try {
      const remote = await $fetch<Partial<import('@luxtime/shared').HomepageConfigDto>>(
        `${baseUrl}/settings/homepage/public`,
      );
      return mergeHomepageConfig(remote);
    } catch {
      return structuredClone(DEFAULT_HOMEPAGE_CONFIG);
    }
  }

  return { fetchConfig, DEFAULT_HOMEPAGE_CONFIG };
}
