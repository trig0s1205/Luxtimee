import { expect, test, type Page } from '@playwright/test';
import { staffCredentialLogin } from './helpers/staff-login';

const enabled = process.env.PLAYWRIGHT_POS_LOCAL === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const shots = process.env.POS_UI_SHOTS ?? '/opt/cursor/artifacts/pos-ui';
const PRICE = 180_000;

test.skip(!enabled, 'Solo con PLAYWRIGHT_POS_LOCAL=1 contra la API local');

test.describe.configure({ mode: 'serial' });

const consoleErrors: string[] = [];

function track(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|Failed to load resource.*favicon/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  page.on('response', (res) => {
    if (res.status() === 401) consoleErrors.push(`401 ${res.url()}`);
  });
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `${shots}/${name}.png`,
    fullPage: true,
  });
}

async function login(page: Page, email: string, password: string) {
  track(page);
  await staffCredentialLogin(page, baseURL, email, password);
  await page.waitForURL(/\/admin\//, { timeout: 20_000 });
}

async function scanSku(page: Page, sku: string) {
  const scan = page.getByPlaceholder(
    'Escanea el código o busca por SKU, marca o modelo',
  );
  await scan.click();
  await scan.fill('');
  await page.keyboard.type(sku, { delay: 8 });
  await page.keyboard.press('Enter');
  await expect(page.locator('.pos-cart__sku', { hasText: sku })).toBeVisible();
}

async function payAndSell(
  page: Page,
  method: 'Efectivo' | 'Transferencia' | 'Datáfono Bold',
  customer: string,
) {
  await page.getByPlaceholder('Nombre del cliente').fill(customer);
  await page.locator('.pos-payments select').first().selectOption({ label: method });
  await page.getByPlaceholder('Monto').fill(String(PRICE));
  if (method === 'Efectivo') {
    await page.getByPlaceholder('Recibido').fill(String(PRICE + 20_000));
  }
  if (method === 'Transferencia') {
    await page.getByPlaceholder('Referencia (opcional)').fill('TRX-UI');
  }
  if (method === 'Datáfono Bold') {
    await page.getByPlaceholder('Aprobación').fill('123456');
    await page.getByPlaceholder('Últimos 4').fill('4242');
  }
  const submit = page.locator('.pos-checkout').getByRole('button', { name: 'Registrar venta' });
  await expect(submit).toBeEnabled();
  await submit.click();
  const confirm = page.getByRole('dialog', { name: 'Confirmar venta' });
  await expect(confirm).toContainText('180.000');
  await confirm.getByRole('button', { name: 'Registrar venta' }).click();
  const done = page.getByRole('dialog', { name: 'Venta registrada' });
  await expect(done).toContainText('Venta registrada');
  await expect(done).toContainText(/LXT-/);
  if (method === 'Efectivo') {
    await expect(done).toContainText('20.000');
  }
}

test('vendedor local: POS, escáner, catálogo y tres pagos', async ({ page }) => {
  await login(page, 'ui-seller@pos.local', 'vendedor-local-qa');
  await expect(page).toHaveURL(/\/admin\/pos$/);
  await expect(page.getByRole('heading', { name: 'POS' })).toBeVisible();
  await shot(page, '01-vendedor-pos');

  await page.goto('/admin/gastos');
  await expect(page).toHaveURL(/\/admin\/pos$/);
  await page.goto('/admin/inventario');
  await expect(page).toHaveURL(/\/admin\/pos$/);

  const catalogSearch = page.getByPlaceholder('Buscar en catálogo');
  await expect(catalogSearch).toBeVisible();
  await catalogSearch.fill('LT-100');
  await expect(page.locator('.pos-card__sku', { hasText: 'LT-1005' })).toBeVisible();
  await expect(page.locator('.pos-card img').first()).toBeVisible();
  await expect(page.getByText(/Quedan \d|Última unidad/).first()).toBeVisible();
  await expect(page.getByText('Cargando')).toHaveCount(0);
  await shot(page, '02-catalogo-visual');

  await scanSku(page, 'LT-1001');
  await expect(page.getByText(/Total/).first()).toContainText('180.000');
  await shot(page, '03-escaner-carrito');
  await payAndSell(page, 'Efectivo', 'Cliente Efectivo');
  await shot(page, '04-venta-efectivo');

  const pdfWait = page.context().waitForEvent('response', {
    predicate: (res) =>
      res.url().includes('/receipts/') && res.url().includes('/pdf'),
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Descargar comprobante' }).click();
  const pdf = await pdfWait;
  expect(pdf.ok()).toBeTruthy();
  expect(pdf.headers()['content-type'] ?? '').toContain('pdf');
  const fetched = await page.evaluate(async (href) => {
    const res = await fetch(href, { credentials: 'include' });
    const buf = new Uint8Array(await res.arrayBuffer());
    return {
      status: res.status,
      magic: String.fromCharCode(buf[0] ?? 0, buf[1] ?? 0, buf[2] ?? 0, buf[3] ?? 0),
    };
  }, pdf.url());
  expect(fetched.status).toBe(200);
  expect(fetched.magic).toBe('%PDF');

  await page.getByRole('button', { name: 'Nueva venta' }).click();
  await scanSku(page, 'LT-1002');
  await payAndSell(page, 'Transferencia', 'Cliente Transferencia');
  await shot(page, '05-venta-transferencia');
  await page.getByRole('button', { name: 'Nueva venta' }).click();

  await scanSku(page, 'LT-1003');
  await payAndSell(page, 'Datáfono Bold', 'Cliente Bold');
  await shot(page, '06-venta-datafono');
  await page.getByRole('button', { name: 'Nueva venta' }).click();

  await page.goto('/admin/pos/mis-ventas');
  await expect(page.getByRole('heading', { name: /Mis ventas/i })).toBeVisible();
  await expect(page.getByText('LXT-').first()).toBeVisible();
  await shot(page, '07-mis-ventas');

  await page.goto('/admin/comprobantes');
  await page.getByRole('tab', { name: 'Reclamos' }).click();
  await shot(page, '08-reclamos');
  await page.getByRole('tab', { name: 'Consultar' }).click();
  const search = page.getByPlaceholder(
    'N.º de comprobante, cliente, teléfono, documento o SKU',
  );
  await search.fill('LT-1001');
  await expect(page.getByText('LT-1001').first()).toBeVisible();
  const createClaim = page.getByRole('button', { name: 'Registrar reclamo' });
  if (await createClaim.count()) {
    await createClaim.first().click();
    await page.locator('textarea').first().fill('El reloj se adelanta');
    await page.getByRole('button', { name: 'Crear reclamo' }).click();
    await expect(page.getByText(/reclamo abierto/i).first()).toBeVisible({
      timeout: 15_000,
    });
  }
  await page.getByRole('tab', { name: 'Reclamos' }).click();
  await page.getByRole('button', { name: /QA UI Efectivo/ }).first().click();
  await expect(page.getByText('El reloj se adelanta')).toBeVisible();
  await shot(page, '09-reclamo-creado');
});

test('admin: inventario, etiquetas, gastos, venta especial y catálogo', async ({ page }) => {
  await login(page, 'ui-admin@pos.local', 'admin-local-qa-1');
  await expect(page).toHaveURL(/\/admin\/inventario/);
  await page.getByPlaceholder('Buscar por SKU, marca o modelo...').fill('LT-1005');
  await expect(page.getByText('LT-1005').first()).toBeVisible();
  await shot(page, '10-inventario');

  await page.getByTitle('Imprimir etiquetas').first().click();
  await expect(page.getByRole('heading', { name: 'Imprimir etiquetas' })).toBeVisible();
  await expect(page.locator('.admin-labels-modal').getByText('LT-1005')).toBeVisible();
  await shot(page, '11-etiquetas-code128');
  const labelPdf = page.waitForResponse(
    (res) =>
      res.url().includes('/labels/watches/pdf') &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Generar PDF' }).click();
  const labels = await labelPdf;
  expect(labels.ok()).toBeTruthy();
  expect(labels.headers()['content-type'] ?? '').toContain('pdf');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.goto('/admin/gastos');
  await expect(page.locator('.admin-expenses-totals').getByText('Plataforma')).toBeVisible();
  await expect(page.locator('.admin-expenses-totals').getByText('Local')).toBeVisible();
  await page.getByPlaceholder('Tijeras, cinta, bolsas...').fill('QA UI Plataforma');
  await page.locator('input[type="number"]').first().fill('40000');
  await page.locator('form select').selectOption({ label: 'Plataforma' });
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  await expect(page.getByText('QA UI Plataforma')).toBeVisible();
  await page.getByPlaceholder('Tijeras, cinta, bolsas...').fill('QA UI Local');
  await page.locator('input[type="number"]').first().fill('15000');
  await page.locator('form select').selectOption({ label: 'Local' });
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  await expect(page.getByText('QA UI Local')).toBeVisible();
  await shot(page, '12-gastos-origen');

  await page.goto('/admin/pedidos/especiales');
  await page.getByPlaceholder('Buscar reloj por marca, modelo o SKU...').fill('LT-1004');
  await expect(page.getByText('LT-1004').first()).toBeVisible();
  await page.getByText('LT-1004').first().click();
  await page.locator('#special-price').fill('70000');
  await page.locator('#special-note').fill('   ');
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  await expect(page.getByText('La nota es obligatoria')).toBeVisible();
  await shot(page, '13-especial-sin-nota');
  await page.locator('#special-note').fill('Reloj de muestra con caja rota');
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  await expect(page.getByText('Reloj de muestra con caja rota')).toBeVisible();
  await shot(page, '14-especial-ok');
  const specialPdf = page.context().waitForEvent('response', {
    predicate: (res) =>
      res.url().includes('/receipts/') && res.url().includes('/pdf'),
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Descargar comprobante' }).first().click();
  const special = await specialPdf;
  expect(special.ok()).toBeTruthy();
  expect(special.headers()['content-type'] ?? '').toContain('pdf');

  await page.goto('/catalogo?search=LT-1005');
  await expect(page.getByText(/1 modelos disponibles/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('No hay relojes con estos filtros.')).toHaveCount(0);
  await shot(page, '15-catalogo-publico');
});

test.afterAll(() => {
  const noisy = consoleErrors.filter(
    (line) => !/cdn\.example|qa-ui\.mp4|Download the React DevTools/i.test(line),
  );
  if (noisy.length) {
    // eslint-disable-next-line no-console
    console.log('CONSOLE_ERRORS\n' + noisy.join('\n'));
  }
});
