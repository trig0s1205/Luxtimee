import { test, expect } from '@playwright/test';
import { acceptCookies, clearCookiesConsent } from './helpers/setup';

test.describe('Consentimiento de cookies', () => {
  test('muestra banner si no hay consentimiento previo', async ({ page }) => {
    await clearCookiesConsent(page);
    await page.goto('/');
    await expect(page.locator('.cookie-banner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aceptar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Política de datos' })).toHaveAttribute(
      'href',
      '/politica-de-privacidad',
    );
  });

  test('aceptar oculta banner y persiste en localStorage', async ({ page }) => {
    await clearCookiesConsent(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.locator('.cookie-banner')).toHaveCount(0);

    const stored = await page.evaluate(() => localStorage.getItem('LUXTIMEE-cookies'));
    expect(stored).toBe('1');
  });

  test('con consentimiento previo no muestra banner', async ({ page }) => {
    await acceptCookies(page);
    await page.goto('/');
    await expect(page.locator('.cookie-banner')).toHaveCount(0);
  });
});
