import { test, expect } from '@playwright/test';
import { gotoStaffLogin, resolveStaffLoginSlug } from './helpers/staff-login';

test.describe('Seguridad admin y acceso staff', () => {
  test('/admin sin sesión redirige a vigilancia', async ({ page }) => {
    await page.goto('/admin/inventario');
    await expect(page).toHaveURL(/\/vigilancia/);
    await expect(page.getByRole('heading', { name: /Estás intentando/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver al inicio' })).toBeVisible();
  });

  test('/admin/dashboards/ganancia sin sesión redirige a vigilancia', async ({ page }) => {
    await page.goto('/admin/dashboards/ganancia');
    await expect(page).toHaveURL(/\/vigilancia/);
  });

  test('token de acceso staff inválido responde 404', async ({ page }) => {
    const response = await page.goto('/acceso/token-invalido-xyz');
    expect(response?.status()).toBe(404);
  });

  test('/ingresar ya no existe', async ({ page }) => {
    const response = await page.goto('/ingresar');
    expect(response?.status()).toBe(404);
  });

  test('login staff muestra formulario en slug configurado', async ({ page, baseURL }) => {
    await gotoStaffLogin(page, baseURL!);
    await expect(page).toHaveURL(new RegExp(`/acceso/${await resolveStaffLoginSlug(baseURL!)}$`));
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('ADMIN no accede a dashboard de ganancia', async ({ page, baseURL }) => {
    test.skip(
      !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
      'Requiere PLAYWRIGHT_ADMIN_EMAIL y PLAYWRIGHT_ADMIN_PASSWORD',
    );

    await gotoStaffLogin(page, baseURL!);
    await page.locator('#login-email').fill(process.env.PLAYWRIGHT_ADMIN_EMAIL!);
    await page.locator('#login-password').fill(process.env.PLAYWRIGHT_ADMIN_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/admin\//);

    const response = await page.goto('/admin/dashboards/ganancia');
    expect(response?.status()).toBe(403);
    await expect(page.locator('body')).toContainText(/403|Solo Super Admin|Forbidden/i);
  });
});
