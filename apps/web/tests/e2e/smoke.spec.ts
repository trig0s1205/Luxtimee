import { test, expect } from '@playwright/test';
import { acceptCookies } from './helpers/setup';
import { gotoStaffLogin, resolveStaffLoginSlug } from './helpers/staff-login';

test.describe('Smoke storefront', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test('home carga con marca LUXTIMEE', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LUXTIMEE/i);
    const luxHeading = page.getByRole('heading', { name: /LUX/i });
    if (await luxHeading.count()) {
      await expect(luxHeading.first()).toBeVisible();
    } else {
      await expect(page.getByText('LUXTIMEE').first()).toBeVisible();
    }
  });

  test('catálogo es accesible', async ({ page }) => {
    await page.goto('/catalogo');
    await expect(page.getByRole('heading', { name: 'Nuestros relojes' })).toBeVisible();
  });
});

test.describe('Smoke staff login', () => {
  test('login staff con credenciales válidas', async ({ page, baseURL }) => {
    test.skip(
      !process.env.PLAYWRIGHT_STAFF_EMAIL || !process.env.PLAYWRIGHT_STAFF_PASSWORD,
      'Requiere PLAYWRIGHT_STAFF_EMAIL y PLAYWRIGHT_STAFF_PASSWORD',
    );

    await gotoStaffLogin(page, baseURL!);
    await expect(page.getByRole('heading', { name: /Iniciar/i })).toBeVisible();

    await page.locator('#login-email').fill(process.env.PLAYWRIGHT_STAFF_EMAIL!);
    await page.locator('#login-password').fill(process.env.PLAYWRIGHT_STAFF_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/admin\//);
  });

  test('URL de login staff usa slug configurado', async ({ page, baseURL }) => {
    await gotoStaffLogin(page, baseURL!);
    await expect(page).toHaveURL(new RegExp(`/acceso/${await resolveStaffLoginSlug(baseURL!)}$`));
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });
});
