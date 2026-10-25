import { expect, test, type Page } from '@playwright/test';

const local = /localhost|127\.0\.0\.1/.test(process.env.PLAYWRIGHT_BASE_URL ?? '');

test.describe('SEO de páginas públicas', () => {
  test.skip(!local, 'Corre contra el build local');

  const pages = ['/', '/catalogo', '/carrito', '/checkout', '/mayoristas', '/sorteos', '/politica-de-privacidad', '/terminos-y-condiciones'];

  for (const path of pages) {
    test(`${path} tiene un h1, título, descripción, canonical y Open Graph`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveTitle(/LUXTIMEE/);
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveCount(1);
      await expect(description).toHaveAttribute('content', /.+/);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(`https://www.luxtimee.com${path === '/' ? '/' : path}`);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
      expect(await page.locator('html').getAttribute('lang')).toBe('es-CO');
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      if (path === '/carrito' || path === '/checkout') expect(robots).toContain('noindex');
      else expect(robots).toContain('index');
      await expectJsonLd(page);
      expect(errors.filter((line) => /hydration|Hydration/i.test(line))).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test('catálogo enlaza productos y el sitemap los lista', async ({ page, request }) => {
    await page.goto('/catalogo');
    const hrefs = await page.locator('a[href^="/producto/"]').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href')),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();
    const xml = await sitemap.text();
    expect(xml).toContain('/producto/');
    expect(xml).toContain('<lastmod>');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap: https://www.luxtimee.com/sitemap.xml');
    expect(robots).toContain('Disallow: /admin');
    const llms = await (await request.get('/llms.txt')).text();
    expect(llms).toContain('LUXTIMEE');
    expect(llms).toContain('sitemap.xml');
  });

  test('producto tiene JSON-LD de oferta y la 404 es noindex', async ({ page, request }) => {
    await page.goto('/producto/rolex-submariner-date');
    await expect(page.locator('h1')).toHaveCount(1);
    const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
    const graph = raw.map((item) => JSON.parse(item));
    const nodes = graph.flatMap((item) => item['@graph'] ?? [item]);
    const product = nodes.find((node) => node['@type'] === 'Product');
    expect(product?.offers?.priceCurrency).toBe('COP');
    expect(product?.sku).toBeTruthy();
    const missing = await request.get('/producto/slug-que-no-existe-e2e');
    expect(missing.status()).toBe(404);
    const html = await missing.text();
    expect(html).toContain('noindex');
    expect(html).toContain('Esta ruta');
  });
});

async function expectJsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(raw.length).toBeGreaterThan(0);
  for (const item of raw) JSON.parse(item);
}
