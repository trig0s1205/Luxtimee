import { test, expect } from '@playwright/test';
import { acceptCookies } from './helpers/setup';

test.describe('Catálogo y carrito', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
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

  test('añadir producto desde catálogo abre bolsa', async ({ page }) => {
    await page.goto('/catalogo');
    const addButton = page.locator('.catalog-grid .add-btn').first();
    await expect(addButton).toBeVisible({ timeout: 15_000 });
    await addButton.click();
    await expect(page.getByRole('button', { name: /Bolsa \(1\)/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#cart-drawer.open')).toBeVisible();
    await expect(page.locator('#cart-footer a[href="/checkout"]')).toBeVisible();
  });
});
