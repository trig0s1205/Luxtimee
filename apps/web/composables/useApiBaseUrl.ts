function resolveAbsoluteApiBase(base: string, siteUrl: string): string {
  const trimmed = base.replace(/\/$/, '');
  if (!trimmed.startsWith('/')) return trimmed;
  const origin = siteUrl.replace(/\/$/, '');
  if (origin) return `${origin}${trimmed}`;
  if (import.meta.server) {
    try {
      const req = useRequestURL();
      return `${req.origin}${trimmed}`;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function useApiBaseUrl() {
  const config = useRuntimeConfig();
  const raw = (import.meta.server ? config.apiInternalUrl : config.public.apiBaseUrl) as string;
  const siteUrl = String(config.public.siteUrl || '');
  if (import.meta.server && raw.startsWith('/')) {
    return resolveAbsoluteApiBase(raw, siteUrl);
  }
  return raw.replace(/\/$/, '') || raw;
}

/** Subidas grandes (fotos/video) van directo a Cloud Run; Vercel corta a ~4.5MB (413). */
export function useApiUploadUrl() {
  const config = useRuntimeConfig();
  return (config.public.apiUploadUrl || config.public.apiBaseUrl) as string;
}
