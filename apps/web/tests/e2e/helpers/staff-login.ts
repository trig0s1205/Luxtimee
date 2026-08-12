import { expect } from '@playwright/test';

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

async function fillLuxInput(page: import('@playwright/test').Page, selector: string, value: string) {
  const input = page.locator(selector);
  await input.click();
  await input.fill('');
  await input.pressSequentially(value, { delay: 15 });
  await expect(input).toHaveValue(value);
}

export async function staffCredentialLogin(
  page: import('@playwright/test').Page,
  baseURL: string,
  email: string,
  password: string,
) {
  await page.addInitScript(() => {
    localStorage.setItem('LUXTIMEE-cookies', '1');
  });
  await gotoStaffLogin(page, baseURL);
  await page.waitForLoadState('networkidle');

  await fillLuxInput(page, '#login-email', email);
  await fillLuxInput(page, '#login-password', password);

  const loginWait = page.waitForResponse(
    (res) => res.url().includes('/auth/login') && res.request().method() === 'POST',
    { timeout: 30_000 },
  );

  await page.locator('form.auth-form button[type="submit"]').click();
  const response = await loginWait;

  if (!response.ok()) {
    const body = await response.text().catch(() => '');
    throw new Error(`Login API ${response.status()}: ${body.slice(0, 240)}`);
  }
}
