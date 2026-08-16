export function useApiBaseUrl() {
  const config = useRuntimeConfig();
  return (import.meta.server ? config.apiInternalUrl : config.public.apiBaseUrl) as string;
}

/** Subidas grandes (fotos/video) van directo a Cloud Run; Vercel corta a ~4.5MB (413). */
export function useApiUploadUrl() {
  const config = useRuntimeConfig();
  return (config.public.apiUploadUrl || config.public.apiBaseUrl) as string;
}
