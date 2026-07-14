import { test, expect } from '@playwright/test';

test('home carga y muestra marca Luxtime', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /LUX/i })).toBeVisible();
});

test('catálogo es accesible', async ({ page }) => {
  await page.goto('/catalogo');
  await expect(page.getByText(/Catálogo/i).first()).toBeVisible();
});
