import { test, expect } from '@playwright/test';
import { acceptCookies } from './helpers/setup';
import { fetchFirstCatalogSlug } from './helpers/catalog';

test.describe('Catálogo y carrito', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
    await page.addInitScript(() => localStorage.removeItem('LUXTIMEE-cart'));
  });

  test('catálogo muestra encabezado y grid', async ({ page }) => {
    await page.goto('/catalogo');
    await expect(page.getByRole('heading', { name: 'Nuestros relojes' })).toBeVisible();
    await expect(page.locator('.catalog-grid')).toBeVisible();
  });

  test('producto inexistente responde 404', async ({ page }) => {
    const response = await page.goto('/producto/slug-que-no-existe-e2e');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Esta ruta no existe')).toBeVisible();
  });

  test('carrito vacío muestra mensaje', async ({ page }) => {
    await page.goto('/carrito');
    await expect(page.getByRole('heading', { name: 'Tu carrito' })).toBeVisible();
    await expect(page.getByText('Tu carrito está vacío.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir al catálogo' })).toBeVisible();
  });

  test('banner mayorista visible en carrito retail', async ({ page }) => {
    await page.goto('/carrito');
    await expect(page.getByRole('link', { name: /Ver mayoristas/i })).toBeVisible();
  });

  test('añadir producto desde catálogo abre bolsa', async ({ page, baseURL }) => {
    await page.goto('/catalogo');
    await expect(page.locator('.catalog-grid .products-card').first()).toBeVisible({ timeout: 20_000 });

    const slug = await fetchFirstCatalogSlug(page, baseURL!);
    await page.goto(`/producto/${slug}`);
    await page.getByRole('button', { name: 'Agregar al carrito' }).click();

    await expect(page.locator('#cart-drawer')).toHaveAttribute('aria-hidden', 'false', { timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Bolsa \(1\)/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#cart-footer a[href="/checkout"]')).toBeVisible();
  });
});
