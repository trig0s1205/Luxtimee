import { test, expect } from '@playwright/test';
import { acceptCookies } from './helpers/setup';

test.describe('Páginas legales', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test('política de privacidad carga', async ({ page }) => {
    await page.goto('/politica-de-privacidad');
    await expect(page).toHaveURL(/politica-de-privacidad/);
    await expect(page.locator('body')).toContainText(/privacidad|datos|LUXTIMEE/i);
  });

  test('términos y condiciones carga', async ({ page }) => {
    await page.goto('/terminos-y-condiciones');
    await expect(page).toHaveURL(/terminos-y-condiciones/);
    await expect(page.locator('body')).toContainText(/términos|condiciones|LUXTIMEE/i);
  });

  test('/legal/privacidad redirige a política', async ({ page }) => {
    await page.goto('/legal/privacidad');
    await expect(page).toHaveURL(/politica-de-privacidad/);
  });

  test('/legal/terminos redirige a términos', async ({ page }) => {
    await page.goto('/legal/terminos');
    await expect(page).toHaveURL(/terminos-y-condiciones/);
  });
});
