import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { gotoStaffLogin } from './helpers/staff-login';

const { encodePngImage, fingerprintImageBytes } = createRequire(import.meta.url)('@luxtime/shared') as {
  encodePngImage: (rgba: Uint8Array, width: number, height: number) => Uint8Array;
  fingerprintImageBytes: (bytes: Uint8Array) => Promise<{ contentHash: string; perceptualHash: string | null }>;
};

const enabled = process.env.PLAYWRIGHT_LOCAL === '1';
const password = process.env.SEED_ADMIN_PASSWORD || 'localtest';
const email = 'lidia@luxtime.co';
const prefix = 'duplocal';

test.describe('avisos de fotos repetidas', () => {
  test.skip(!enabled, 'solo contra el stack local');

  const prisma = new PrismaClient();
  const fixtureDir = '/tmp/luxtimee-dup';
  const front = join(fixtureDir, 'dup-frente.png');
  const back = join(fixtureDir, 'dup-dorso.png');
  let watchId = '';

  test.beforeAll(async () => {
    mkdirSync(fixtureDir, { recursive: true });
    mkdirSync(join(process.cwd(), '../api/uploads/watches'), { recursive: true });
    const png = encodePngImage(gradient(96, 128), 96, 128);
    writeFileSync(front, png);
    writeFileSync(back, png);
    writeFileSync(join(process.cwd(), '../api/uploads/watches/dup-local.png'), png);
    const fingerprint = await fingerprintImageBytes(png);
    const brand = await prisma.brand.upsert({
      where: { slug: prefix },
      update: { name: 'Marca local' },
      create: { name: 'Marca local', slug: prefix },
    });
    const watch = await prisma.watch.upsert({
      where: { sku: 'DUP-LOCAL' },
      update: {
        model: 'Submariner local',
        frontImageUrl: '/uploads/watches/dup-local.png',
        images: ['/uploads/watches/dup-local.png'],
        deletedAt: null,
      },
      create: {
        sku: 'DUP-LOCAL',
        slug: 'dup-local',
        brandId: brand.id,
        model: 'Submariner local',
        movementType: 'Automático',
        functions: [],
        retailPrice: 0,
        wholesalePrice: 0,
        stock: 0,
        status: 'AGOTADO',
        isPublished: false,
        frontImageUrl: '/uploads/watches/dup-local.png',
        images: ['/uploads/watches/dup-local.png'],
      },
    });
    watchId = watch.id;
    await prisma.watchImageFingerprint.upsert({
      where: { watchId_imageUrl: { watchId, imageUrl: '/uploads/watches/dup-local.png' } },
      update: {
        slot: 'front',
        contentHash: fingerprint.contentHash,
        perceptualHash: fingerprint.perceptualHash,
      },
      create: {
        watchId,
        imageUrl: '/uploads/watches/dup-local.png',
        slot: 'front',
        contentHash: fingerprint.contentHash,
        perceptualHash: fingerprint.perceptualHash,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('alta, edición y carga masiva', async ({ page, baseURL }) => {
    const uploads: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/upload-media') || request.url().includes('/watches/bulk-draft')) {
        uploads.push(request.url());
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('LUXTIMEE-cookies', '1');
    });
    await gotoStaffLogin(page, baseURL ?? 'http://127.0.0.1:3000');
    await page.waitForLoadState('networkidle');
    for (const [selector, value] of [['#login-email', email], ['#login-password', password]] as const) {
      const input = page.locator(selector);
      await input.click();
      await input.fill('');
      await input.pressSequentially(value, { delay: 15 });
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
    await page.getByRole('button', { name: '+ Nuevo Reloj' }).click();
    await page.getByRole('button', { name: 'MULTIMEDIA' }).click();
    await page.locator('.admin-modal .admin-media-slot').nth(0).locator('input[type=file]').setInputFiles(front);
    const warning = page.getByTestId('image-duplicate-warning').first();
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('DUP-LOCAL');
    await expect(warning).toContainText('Ya existe');
    mkdirSync('/opt/cursor/artifacts', { recursive: true });
    await warning.screenshot({ path: '/opt/cursor/artifacts/aviso-foto-individual.png' });
    await warning.getByRole('button', { name: 'Quitar de esta carga' }).click();
    await expect(page.getByTestId('image-duplicate-warning')).toHaveCount(0);
    await page.getByRole('button', { name: 'Guardar borrador con imágenes' }).click();
    await expect(page.locator('.admin-media-error')).toContainText('foto');
    expect(uploads).toEqual([]);

    await page.locator('.admin-modal').getByRole('button', { name: 'Cancelar' }).click();
    await page.goto(`/admin/inventario?reloj=${watchId}`);
    await expect(page.getByRole('heading', { name: 'Editar reloj' })).toBeVisible();
    await page.getByRole('button', { name: 'MULTIMEDIA' }).click();
    await page.locator('.admin-modal .admin-media-slot').nth(1).locator('input[type=file]').setInputFiles(front);
    await expect(page.getByTestId('image-duplicate-warning')).toContainText('DUP-LOCAL');
    await page.locator('.admin-modal').getByRole('button', { name: 'Cancelar' }).click();

    await page.getByRole('button', { name: 'Carga por fotos' }).click();
    await page.locator('input.admin-bulk-draft-file').setInputFiles([front, back]);
    await page.getByRole('button', { name: 'Usar orden actual' }).click();
    await page.getByRole('button', { name: 'Subir todo' }).click();
    const bulk = page.getByTestId('bulk-duplicate-warning');
    await expect(bulk).toBeVisible();
    await expect(bulk).toContainText('Quitar todas las repetidas');
    await bulk.screenshot({ path: '/opt/cursor/artifacts/aviso-carga-masiva.png' });
    await bulk.getByRole('button', { name: 'Quitar todas las repetidas' }).click();
    await expect(bulk).toHaveCount(0);
    expect(uploads.filter((url) => url.includes('/watches/bulk-draft'))).toEqual([]);
  });
});

function gradient(width: number, height: number) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const value = Math.round((x / Math.max(1, width - 1)) * 220) + 15;
      rgba[index] = value;
      rgba[index + 1] = value;
      rgba[index + 2] = value;
      rgba[index + 3] = 255;
    }
  }
  return rgba;
}
