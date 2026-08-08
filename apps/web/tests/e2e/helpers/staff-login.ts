export function staffLoginSlug() {
  return process.env.PLAYWRIGHT_STAFF_LOGIN_SLUG
    ?? process.env.NUXT_PUBLIC_STAFF_LOGIN_SLUG
    ?? 'dev-portal-lx9k2';
}

export function staffLoginUrl(baseURL: string) {
  return `${baseURL.replace(/\/$/, '')}/acceso/${staffLoginSlug()}`;
}
