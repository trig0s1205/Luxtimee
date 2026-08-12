import { test, expect } from '@playwright/test';
import { acceptCookies } from './helpers/setup';

test.describe('Certificado público', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test('slug inválido muestra 404', async ({ page }) => {
    const response = await page.goto('/certificado/certificado-inexistente-e2e');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Esta ruta no existe')).toBeVisible();
  });
});
