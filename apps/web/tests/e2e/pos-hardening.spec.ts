import { expect, test } from '@playwright/test';

const enabled = process.env.PLAYWRIGHT_POS_HARDENING === '1';

test.skip(!enabled, 'Solo con PLAYWRIGHT_POS_HARDENING=1');

test('POS local: catálogo, descuento, efectivo, comprobante y anulación', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('LUXTIMEE-cookies', '1');
  });
  const login = await page.request.post('http://127.0.0.1:3000/api/v1/auth/login', {
    data: { email: 'vendedora@luxtime.co', password: 'local-seed-pass' },
  });
  expect(login.ok()).toBeTruthy();
  await page.goto('/admin/pos');
  await expect(page.getByRole('heading', { name: 'POS' })).toBeVisible();
  await expect(page.getByText('Lector listo')).toHaveCount(0);
  await expect(page.getByText('Cargar más')).toHaveCount(0);
  await expect(page.getByText('Documento (opcional)')).toBeVisible();
  await expect(page.getByText('Email (opcional)')).toBeVisible();
  await expect(page.getByText(/Mostrando 1–30 de/)).toBeVisible();
  await expect(page.getByRole('button', { name: '2', exact: true })).toBeVisible();

  const search = page.getByLabel('Buscar por marca, modelo o SKU');
  await search.fill('QA-0010');
  await search.press('Enter');
  await expect(page.locator('.pos-card__sku', { hasText: 'QA-0010' })).toBeVisible();
  await page.locator('.pos-card', { hasText: 'QA-0010' }).getByRole('button', { name: 'Agregar' }).click();
  await expect(page.locator('.pos-cart__sku', { hasText: 'QA-0010' })).toBeVisible();

  await page.locator('.pos-cart__discount select').selectOption('percent');
  await page.locator('.pos-cart__discount input').fill('10');
  await page.getByPlaceholder('Motivo del descuento').fill('Promo de mostrador');
  await page.getByPlaceholder('Nombre del cliente').fill('Cliente QA');
  await page.getByPlaceholder('Monto recibido').fill('200000');
  await expect(page.getByText(/Vuelto/).first()).toBeVisible();
  const started = Date.now();
  await page.locator('.pos-checkout').getByRole('button', { name: 'Registrar venta' }).click();
  await page.getByRole('dialog', { name: 'Confirmar venta' }).getByRole('button', { name: 'Registrar venta' }).click();
  const done = page.getByRole('dialog', { name: 'Venta registrada' });
  await expect(done).toContainText(/LXT-/);
  expect(Date.now() - started).toBeLessThan(2000);
  await expect(done.getByRole('button', { name: 'Descargar comprobante' })).toBeVisible();
  await expect(done.getByRole('button', { name: 'Imprimir' })).toBeVisible();

  await page.getByRole('button', { name: 'Nueva venta' }).click();
  await expect(page.locator('.pos-cart__sku')).toHaveCount(0);

  await page.goto('/admin/pos/mis-ventas');
  await page.getByRole('button', { name: 'Anular' }).first().click();
  await page.getByPlaceholder('Motivo (mínimo 5 caracteres)').fill('Prueba de anulación');
  await page.getByRole('button', { name: 'Anular', exact: true }).last().click();
  await expect(page.getByText('Anulado').first()).toBeVisible();
});
