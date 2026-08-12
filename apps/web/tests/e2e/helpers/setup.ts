import type { Page } from '@playwright/test';

export const COOKIE_KEY = 'LUXTIMEE-cookies';
export const CART_KEY = 'LUXTIMEE-cart';

export async function acceptCookies(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, '1');
  }, COOKIE_KEY);
}

export async function clearCookiesConsent(page: Page) {
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
  }, COOKIE_KEY);
}

export async function seedRetailCart(page: Page, watchId = 'e2e-watch-id') {
  const item = {
    watchId,
    slug: 'e2e-test-watch',
    productName: 'Rolex Submariner Date',
    productRef: 'LUX-E2E-001',
    productImage: null,
    quantity: 1,
    retailPrice: 95000000,
    wholesalePrice: 85000000,
    stock: 5,
  };

  await page.addInitScript(({ key, payload }) => {
    localStorage.setItem(key, JSON.stringify([payload]));
  }, { key: CART_KEY, payload: item });
}

export async function mockPreOrderSubmit(page: Page) {
  await page.route('**/pre-orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        whatsappUrl: 'https://wa.me/573000000000?text=E2E%20test',
      }),
    });
  });
}
