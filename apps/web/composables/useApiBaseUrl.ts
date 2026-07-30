export function useApiBaseUrl() {
  const config = useRuntimeConfig();
  return (import.meta.server ? config.apiInternalUrl : config.public.apiBaseUrl) as string;
}
