import type { Page } from '@playwright/test';

export async function resolveApiBaseUrl(page: Page, siteOrigin: string): Promise<string> {
  const html = await (await page.request.get(siteOrigin)).text();
  const match = html.match(/apiBaseUrl:"([^"]+)"/);
  if (!match?.[1]) {
    throw new Error('No se pudo resolver apiBaseUrl desde el HTML público');
  }
  return match[1];
}

export async function fetchFirstCatalogSlug(page: Page, siteOrigin: string): Promise<string> {
  const apiBase = await resolveApiBaseUrl(page, siteOrigin);
  const response = await page.request.get(`${apiBase}/catalog?limit=1&page=1&sort=newest`);
  if (!response.ok()) {
    throw new Error(`Catálogo API respondió ${response.status()}`);
  }
  const body = await response.json() as { data?: Array<{ slug?: string }> };
  const slug = body.data?.[0]?.slug;
  if (!slug) {
    throw new Error('No hay productos publicados en catálogo');
  }
  return slug;
}
