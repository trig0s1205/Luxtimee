const DEV_STAFF_LOGIN_SLUG = 'dev-portal-lx9k2';

/** En producción, sin slug configurado no hay ruta pública de respaldo. */
export function resolveStaffLoginSlug(
  configured: string | undefined | null,
  nodeEnv?: string,
): string | null {
  const slug = configured?.trim() ?? '';
  if (slug) return slug;
  if (nodeEnv === 'production') return null;
  return DEV_STAFF_LOGIN_SLUG;
}
