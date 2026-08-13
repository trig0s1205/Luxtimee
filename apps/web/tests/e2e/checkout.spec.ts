import { test, expect } from '@playwright/test';
import { acceptCookies, mockPreOrderSubmit, seedRetailCart } from './helpers/setup';

test.describe('Checkout retail', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookies(page);
  });

  test('checkout con carrito vacío muestra aviso', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByText('No hay productos en el carrito.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver al catálogo' })).toBeVisible();
  });

  test('checkout exige aceptar términos', async ({ page }) => {
    await seedRetailCart(page);
    await page.goto('/checkout');
    await expect(page.locator('#checkout-name')).toBeVisible({ timeout: 15_000 });

    await page.locator('#checkout-name').fill('Cliente E2E');
    await page.locator('#checkout-address').fill('Calle 123 #45-67');
    await page.locator('#checkout-phone').fill('3001234567');

    const zoneSelect = page.locator('#checkout-shipping');
    await expect(zoneSelect).toBeVisible();
    const options = zoneSelect.locator('option:not([disabled])');
    if (await options.count() > 0) {
      await zoneSelect.selectOption({ index: 1 });
    }

    await page.getByRole('button', { name: 'Comprar por WhatsApp' }).click();
    await expect(page.getByText('Debe aceptar términos y política de datos')).toBeVisible();
  });

  test('checkout exitoso en desktop abre WA en pestaña nueva y muestra fallback', async ({ page }) => {
    await seedRetailCart(page);
    await mockPreOrderSubmit(page);
    await page.goto('/checkout');

    await page.evaluate(() => {
      (window as unknown as { __waPopup?: string }).__waPopup = '';
      window.open = (url?: string | URL) => {
        (window as unknown as { __waPopup?: string }).__waPopup = String(url ?? '');
        return { opener: null, focus: () => undefined } as Window;
      };
    });

    await expect(page.locator('#checkout-name')).toBeVisible({ timeout: 15_000 });
    await page.locator('#checkout-name').fill('Cliente E2E');
    await page.locator('#checkout-address').fill('Calle 123 #45-67');
    await page.locator('#checkout-phone').fill('3001234567');

    const zoneSelect = page.locator('#checkout-shipping');
    if (await zoneSelect.locator('option:not([disabled])').count() > 0) {
      await zoneSelect.selectOption({ index: 1 });
    }

    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Comprar por WhatsApp' }).click();

    await expect(page.getByText('Pedido registrado')).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () =>
      page.evaluate(() => (window as unknown as { __waPopup?: string }).__waPopup ?? ''),
    ).toMatch(/web\.whatsapp\.com/);
    await expect(page.getByRole('button', { name: 'Abrir WhatsApp' })).toBeVisible();

    const cartRaw = await page.evaluate(() => localStorage.getItem('LUXTIMEE-cart'));
    expect(cartRaw === '[]' || cartRaw === null).toBeTruthy();
  });
});
