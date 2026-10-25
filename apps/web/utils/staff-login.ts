const DEV_STAFF_LOGIN_SLUG = 'dev-portal-lx9k2';

export function resolveStaffLoginSlug(
  configured: string | undefined | null,
  nodeEnv?: string,
) {
  const slug = configured?.trim() ?? '';
  if (slug) return slug;
  if (nodeEnv === 'production') return '';
  return DEV_STAFF_LOGIN_SLUG;
}

export function staffLoginBasePath(slug: string) {
  return `/acceso/${slug}`;
}

export function staffLoginPath(
  slug: string,
  query?: Record<string, string | undefined | null>,
) {
  const base = staffLoginBasePath(slug);
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function staffLoginSuccessPath(slug: string) {
  return `${staffLoginBasePath(slug)}/exito`;
}

export function isStaffLoginRoute(path: string, slug: string) {
  const base = staffLoginBasePath(slug);
  return path === base || path.startsWith(`${base}/`);
}

export function useStaffLoginSlug() {
  return useRuntimeConfig().public.staffLoginSlug as string;
}

export function useStaffLoginPath() {
  const slug = useStaffLoginSlug();
  return {
    slug,
    basePath: staffLoginBasePath(slug),
    loginPath: (query?: Record<string, string | undefined | null>) => staffLoginPath(slug, query),
    successPath: staffLoginSuccessPath(slug),
  };
}
