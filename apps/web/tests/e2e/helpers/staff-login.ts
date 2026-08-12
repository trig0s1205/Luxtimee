let cachedSlug: string | null = null;

function slugFromEnv() {
  return process.env.PLAYWRIGHT_STAFF_LOGIN_SLUG
    ?? process.env.NUXT_PUBLIC_STAFF_LOGIN_SLUG
    ?? null;
}

export async function resolveStaffLoginSlug(baseURL: string): Promise<string> {
  const fromEnv = slugFromEnv();
  if (fromEnv) return fromEnv;
  if (cachedSlug) return cachedSlug;

  const origin = baseURL.replace(/\/$/, '');
  const res = await fetch(`${origin}/`);
  const html = await res.text();
  const match = html.match(/staffLoginSlug(?:\\u003a|:)"([^"\\]+)/);
  cachedSlug = match?.[1] ?? 'dev-portal-lx9k2';
  return cachedSlug;
}

/** Slug síncrono: solo válido tras resolveStaffLoginSlug o si hay env. */
export function staffLoginSlug() {
  return slugFromEnv() ?? cachedSlug ?? 'dev-portal-lx9k2';
}

export async function staffLoginUrl(baseURL: string) {
  const slug = await resolveStaffLoginSlug(baseURL);
  return `${baseURL.replace(/\/$/, '')}/acceso/${slug}`;
}

export async function gotoStaffLogin(page: import('@playwright/test').Page, baseURL: string) {
  await page.goto(await staffLoginUrl(baseURL));
}
