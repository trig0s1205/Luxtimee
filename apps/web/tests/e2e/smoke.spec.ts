import { test, expect } from '@playwright/test';
import { staffLoginSlug, staffLoginUrl } from './helpers/staff-login';

test('home carga y muestra marca LUXTIMEE', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /LUX/i })).toBeVisible();
});

test('catálogo es accesible', async ({ page }) => {
  await page.goto('/catalogo');
  await expect(page.getByText(/Catálogo/i).first()).toBeVisible();
});

test('/ingresar ya no existe', async ({ page }) => {
  const response = await page.goto('/ingresar');
  expect(response?.status()).toBe(404);
});

test('token de acceso inválido responde 404', async ({ page }) => {
  const response = await page.goto('/acceso/token-invalido-xyz');
  expect(response?.status()).toBe(404);
});

test('/admin sin sesión redirige al inicio sin revelar login', async ({ page }) => {
  await page.goto('/admin/inventario');
  await expect(page).not.toHaveURL(/\/admin/);
});

test('login staff con credenciales válidas', async ({ page, baseURL }) => {
  test.skip(
    !process.env.PLAYWRIGHT_STAFF_EMAIL || !process.env.PLAYWRIGHT_STAFF_PASSWORD,
    'Requiere PLAYWRIGHT_STAFF_EMAIL y PLAYWRIGHT_STAFF_PASSWORD',
  );

  await page.goto(staffLoginUrl(baseURL!));
  await expect(page.getByRole('heading', { name: /Iniciar/i })).toBeVisible();

  await page.locator('#login-email').fill(process.env.PLAYWRIGHT_STAFF_EMAIL!);
  await page.locator('#login-password').fill(process.env.PLAYWRIGHT_STAFF_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/admin\//);
});

test('URL de login staff usa slug configurado', async ({ page, baseURL }) => {
  await page.goto(staffLoginUrl(baseURL!));
  await expect(page).toHaveURL(new RegExp(`/acceso/${staffLoginSlug()}$`));
  await expect(page.getByLabel('Correo')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
});
