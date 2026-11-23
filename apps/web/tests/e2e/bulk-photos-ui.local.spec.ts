import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { gotoStaffLogin } from './helpers/staff-login';

const { encodeJpegRgba, encodePngImage, fingerprintImageBytes } = createRequire(import.meta.url)('@luxtime/shared') as {
  encodeJpegRgba: (rgba: Uint8Array, width: number, height: number, quality: number) => Uint8Array;
  encodePngImage: (rgba: Uint8Array, width: number, height: number) => Uint8Array;
  fingerprintImageBytes: (bytes: Uint8Array) => Promise<{ contentHash: string; perceptualHash: string | null }>;
};

const enabled = process.env.PLAYWRIGHT_LOCAL === '1';
const password = process.env.SEED_ADMIN_PASSWORD || 'localtest';
const email = 'lidia@luxtime.co';
const artifacts = '/opt/cursor/artifacts';

test.use({ video: 'on', viewport: { width: 1280, height: 800 } });

test.describe('carga por fotos', () => {
  test.skip(!enabled, 'solo contra el stack local');
  test.setTimeout(120_000);

  const prisma = new PrismaClient();
  const dir = '/tmp/luxtimee-bulk-ui';
  let watchId = '';

  test.beforeAll(async () => {
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(process.cwd(), '../api/uploads/watches'), { recursive: true });
    mkdirSync(artifacts, { recursive: true });
    const front = encodePngImage(stripes(96, 128, 0), 96, 128);
    const back = encodePngImage(stripes(96, 128, 40), 96, 128);
    writeFileSync(join(process.cwd(), '../api/uploads/watches/swap-front.png'), front);
    writeFileSync(join(process.cwd(), '../api/uploads/watches/swap-back.png'), back);
    writeFileSync(join(dir, 'exact.png'), front);
    writeFileSync(join(dir, 'near.jpg'), encodeJpegRgba(stripes(96, 128, 0), 96, 128, 60));
    writeFileSync(join(dir, 'normal-a.png'), encodePngImage(stripes(96, 128, 90), 96, 128));
    writeFileSync(join(dir, 'normal-b.png'), encodePngImage(stripes(96, 128, 140), 96, 128));
    const fingerprint = await fingerprintImageBytes(front);
    const backPrint = await fingerprintImageBytes(back);
    const brand = await prisma.brand.upsert({
      where: { slug: 'swaplocal' },
      update: { name: 'Marca swap' },
      create: { name: 'Marca swap', slug: 'swaplocal' },
    });
    const watch = await prisma.watch.upsert({
      where: { sku: 'SWAP-LOCAL' },
      update: {
        frontImageUrl: '/uploads/watches/swap-front.png',
        backImageUrl: '/uploads/watches/swap-back.png',
        primaryImageUrl: '/uploads/watches/swap-front.png',
        secondaryImageUrl: '/uploads/watches/swap-back.png',
        images: ['/uploads/watches/swap-front.png', '/uploads/watches/swap-back.png'],
        deletedAt: null,
      },
      create: {
        sku: 'SWAP-LOCAL',
        slug: 'swap-local',
        brandId: brand.id,
        model: 'Swap local',
        movementType: 'Automático',
        functions: [],
        retailPrice: 0,
        wholesalePrice: 0,
        stock: 0,
        status: 'AGOTADO',
        isPublished: false,
        frontImageUrl: '/uploads/watches/swap-front.png',
        backImageUrl: '/uploads/watches/swap-back.png',
        primaryImageUrl: '/uploads/watches/swap-front.png',
        secondaryImageUrl: '/uploads/watches/swap-back.png',
        images: ['/uploads/watches/swap-front.png', '/uploads/watches/swap-back.png'],
      },
    });
    watchId = watch.id;
    for (const row of [
      { url: '/uploads/watches/swap-front.png', slot: 'front', fingerprint },
      { url: '/uploads/watches/swap-back.png', slot: 'back', fingerprint: backPrint },
    ]) {
      await prisma.watchImageFingerprint.upsert({
        where: { watchId_imageUrl: { watchId, imageUrl: row.url } },
        update: { slot: row.slot, contentHash: row.fingerprint.contentHash, perceptualHash: row.fingerprint.perceptualHash },
        create: {
          watchId,
          imageUrl: row.url,
          slot: row.slot,
          contentHash: row.fingerprint.contentHash,
          perceptualHash: row.fingerprint.perceptualHash,
        },
      });
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('revisa repetidas, sube y intercambia frente y dorso', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('LUXTIMEE-cookies', '1'));
    await gotoStaffLogin(page, 'http://127.0.0.1:3000');
    await page.waitForLoadState('networkidle');
    for (const [selector, value] of [['#login-email', email], ['#login-password', password]] as const) {
      const input = page.locator(selector);
      await input.click();
      await input.fill(value);
      await expect(input).toHaveValue(value);
    }
    const loggedIn = page.waitForResponse(
      (response) => response.url().includes('/auth/mock-login') || response.url().includes('/auth/login'),
      { timeout: 20_000 },
    );
    await page.locator('form.auth-form button[type="submit"]').click();
    await loggedIn;
    await page.waitForURL('**/admin/**', { timeout: 20_000 });
    if (!page.url().includes('/admin/inventario')) await page.goto('/admin/inventario');
    await page.getByRole('button', { name: 'Carga por fotos' }).click();
    await page.screenshot({ path: join(artifacts, 'despues-1-elegir-desktop.png') });
    await page.locator('input.admin-bulk-draft-file').setInputFiles([
      join(dir, 'exact.png'),
      join(dir, 'normal-a.png'),
      join(dir, 'near.jpg'),
      join(dir, 'normal-b.png'),
    ]);
    await expect(page.getByRole('button', { name: 'Usar orden actual' })).toBeVisible();
    await page.screenshot({ path: join(artifacts, 'despues-2-pares-desktop.png') });
    await page.getByRole('button', { name: 'Usar orden actual' }).click();
    await page.getByRole('button', { name: 'Subir todo' }).click();
    const bulk = page.getByTestId('bulk-duplicate-warning');
    await expect(bulk).toBeVisible();
    await expect(bulk).toContainText('Muy parecida');
    await expect(bulk).toContainText('Ya existe');
    await page.screenshot({ path: join(artifacts, 'despues-3-repetidas-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(artifacts, 'despues-3-repetidas-mobile.png') });
    await page.setViewportSize({ width: 1280, height: 800 });
    await bulk.getByRole('button', { name: 'Quitar de esta carga' }).first().click();
    await expect(page.getByText('Se quitó el par completo')).toBeVisible();
    const keep = bulk.getByRole('button', { name: 'Subir igual' });
    const keepCount = await keep.count();
    for (let index = 0; index < keepCount; index += 1) await keep.nth(index).click();
    await page.getByRole('button', { name: 'Subir todo' }).click();
    await expect(page.getByText('quedaron en borrador')).toBeVisible({ timeout: 40_000 });
    await page.screenshot({ path: join(artifacts, 'despues-4-listo-desktop.png') });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(artifacts, 'despues-4-listo-mobile.png') });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/admin/inventario?reloj=${watchId}`);
    await expect(page.getByRole('heading', { name: 'Editar reloj' })).toBeVisible();
    await page.getByRole('button', { name: 'MULTIMEDIA' }).click();
    await page.getByRole('button', { name: 'Intercambiar frente y dorso' }).click();
    await page.screenshot({ path: join(artifacts, 'despues-5-swap-desktop.png') });
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect.poll(async () => {
      const saved = await prisma.watch.findUnique({ where: { id: watchId } });
      return saved?.frontImageUrl;
    }).toBe('/uploads/watches/swap-back.png');
    const saved = await prisma.watch.findUnique({ where: { id: watchId } });
    expect(saved?.backImageUrl).toBe('/uploads/watches/swap-front.png');
    const slots = await prisma.watchImageFingerprint.findMany({ where: { watchId } });
    expect(slots.find((row) => row.imageUrl.endsWith('swap-back.png'))?.slot).toBe('front');
    expect(slots.find((row) => row.imageUrl.endsWith('swap-front.png'))?.slot).toBe('back');
  });
});

function stripes(width: number, height: number, shift: number) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const on = ((x + shift) % 18) < 8;
      const value = on ? 230 : 15;
      rgba[index] = value;
      rgba[index + 1] = (value + shift) % 255;
      rgba[index + 2] = on ? 40 : 200;
      rgba[index + 3] = 255;
    }
  }
  return rgba;
}
