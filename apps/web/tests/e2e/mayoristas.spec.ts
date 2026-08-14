import { test, expect } from '@playwright/test';
import { acceptCookies } from './helpers/setup';

test.describe('Portal mayoristas', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test('landing mayoristas carga', async ({ page }) => {
    await page.goto('/mayoristas');
    await expect(page.locator('body')).toContainText(/mayorista|mayor/i);
  });

  test('catálogo mayorista sin sesión redirige al landing', async ({ page }) => {
    await page.goto('/mayoristas/catalogo');
    await expect(page).toHaveURL(/\/mayoristas\/?$/);
  });

  test('nav tiene enlace Mayoristas', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#navbar').getByRole('link', { name: 'Mayoristas' })).toBeVisible();
  });
});
