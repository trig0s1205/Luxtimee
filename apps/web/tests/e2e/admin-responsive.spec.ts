import { expect, test, type Page } from '@playwright/test';
import { staffCredentialLogin } from './helpers/staff-login';

const ROUTES = [
  '/admin/inventario',
  '/admin/catalog-settings',
  '/admin/pending-info',
  '/admin/pre-pedidos/activos',
  '/admin/pre-pedidos/suspendidos',
  '/admin/pre-pedidos/nuevo',
  '/admin/pedidos/detal',
  '/admin/pedidos/mayor',
  '/admin/pedidos/especiales',
  '/admin/ventas',
  '/admin/socios-mayoristas',
  '/admin/mayorista-ofertas',
  '/admin/garantias',
  '/admin/envios',
  '/admin/notificaciones',
  '/admin/dashboards/salud',
  '/admin/dashboards/analytics',
  '/admin/dashboards/ganancia',
  '/admin/configuracion',
];

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 320, height: 700 },
];

async function overflowPx(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function clippedControls(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const bad: string[] = [];
    const nodes = document.querySelectorAll('.admin-main button, .admin-main .admin-file-btn, .admin-topbar button');
    nodes.forEach((node) => {
      const el = node as HTMLElement;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const box = el.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return;
      if (box.left < -1 || box.right > width + 1) {
        bad.push((el.innerText || el.getAttribute('aria-label') || el.className).trim().slice(0, 60));
      }
    });
    return bad;
  });
}

test.describe('panel admin responsive', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(
      !process.env.PLAYWRIGHT_STAFF_EMAIL || !process.env.PLAYWRIGHT_STAFF_PASSWORD,
      'Requiere PLAYWRIGHT_STAFF_EMAIL y PLAYWRIGHT_STAFF_PASSWORD',
    );
    await staffCredentialLogin(
      page,
      baseURL!,
      process.env.PLAYWRIGHT_STAFF_EMAIL!,
      process.env.PLAYWRIGHT_STAFF_PASSWORD!,
    );
  });

  for (const viewport of VIEWPORTS) {
    test(`ningún módulo se sale de ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const route of ROUTES) {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        if (response && response.status() === 404) continue;
        await expect(page.locator('.admin-main')).toBeVisible();
        expect(await overflowPx(page), route).toBeLessThanOrEqual(1);
        expect(await clippedControls(page), route).toEqual([]);
      }
    });
  }

  test('inventario, notificaciones y subidas de configuración caben en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/admin/inventario');
    await expect(page.getByRole('button', { name: 'Selección' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Nuevo Reloj' })).toBeVisible();
    expect(await overflowPx(page)).toBeLessThanOrEqual(1);
    expect(await clippedControls(page)).toEqual([]);

    await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
    const sidebar = page.locator('.admin-sidebar.is-open');
    await expect(sidebar.getByRole('link', { name: 'Inventario' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Notificaciones' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar menú' }).click();

    await page.goto('/admin/notificaciones');
    await expect(page.getByRole('heading', { name: 'Centro de notificaciones' })).toBeVisible();
    expect(await overflowPx(page)).toBeLessThanOrEqual(1);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Index' }).click();
    for (const label of ['Logo', 'Banner inicio', 'Fundador', 'Reseñas visuales', 'Publicidad de entrada']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.admin-file-btn').first()).toBeVisible();
      expect(await overflowPx(page), label).toBeLessThanOrEqual(1);
      expect(await clippedControls(page), label).toEqual([]);
    }
  });
});
