/**
 * Reprocesa videos de relojes ya subidos a Cloudinary.
 *
 * Uso (desde apps/api o raíz del monorepo):
 *   pnpm migrate:videos -- --dry-run
 *   pnpm migrate:videos
 *   pnpm migrate:videos -- --id=<watchId>
 */

import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');
const require = createRequire(join(apiRoot, 'package.json'));

const { PrismaClient } = require('@prisma/client');
const { v2: cloudinary } = require('cloudinary');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const repoRoot = join(apiRoot, '../..');
loadEnvFile(join(repoRoot, '.env'));
loadEnvFile(join(apiRoot, '.env'));

function assertDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('Falta DATABASE_URL. Agrégala en apps/api/.env (URL de Supabase, no localhost).');
    process.exit(1);
  }
  if (/localhost|127\.0\.0\.1|:5432\/luxtime/.test(url)) {
    console.error('DATABASE_URL apunta a localhost. Para migrar producción, usa la URL de Supabase en apps/api/.env');
    console.error('Ejemplo: postgresql://postgres.xxxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres');
    process.exit(1);
  }
}

assertDatabaseUrl();

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const watchIdArg = process.argv.find((arg) => arg.startsWith('--id='))?.split('=')[1];

const imageServiceUrl = (process.env.IMAGE_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');
const imageServiceKey = process.env.IMAGE_SERVICE_API_KEY || '';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function processVideoBuffer(buffer, filename = 'legacy.mp4') {
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'video/mp4' }), filename);

  const headers = {};
  if (imageServiceKey) headers['X-API-Key'] = imageServiceKey;

  const endpoints = [`${imageServiceUrl}/api/v1/process-video`, `${imageServiceUrl}/process-video`];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers,
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok) {
        lastError = await response.text();
        continue;
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError || 'No se pudo procesar el video');
}

async function uploadVideo(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || 'LUXTIMEE/watches',
        resource_type: 'video',
        format: 'mp4',
        public_id: `watch-video-migrated-${Date.now()}`,
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload fallido'));
        else resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

function extractPublicId(url) {
  if (!url?.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/video\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  return match?.[1] ?? null;
}

async function migrateWatch(watch) {
  const sourceUrl = watch.videoUrl;
  if (!sourceUrl) return { skipped: true, reason: 'sin video' };

  console.log(`→ ${watch.sku} (${watch.id})`);

  if (dryRun) {
    console.log('  dry-run: se reprocesaría', sourceUrl);
    return { dryRun: true };
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`No se pudo descargar ${sourceUrl}`);

  const inputBuffer = Buffer.from(await response.arrayBuffer());
  const optimized = await processVideoBuffer(inputBuffer, `${watch.sku}.mp4`);
  const newUrl = await uploadVideo(optimized);

  await prisma.watch.update({
    where: { id: watch.id },
    data: { videoUrl: newUrl },
  });

  const oldPublicId = extractPublicId(sourceUrl);
  if (oldPublicId) {
    await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'video' }).catch(() => undefined);
  }

  console.log(`  ✓ ${Math.round(inputBuffer.length / 1024 / 1024)}MB → ${Math.round(optimized.length / 1024 / 1024)}MB`);
  return { migrated: true, newUrl };
}

async function main() {
  const watches = watchIdArg
    ? await prisma.watch.findMany({ where: { id: watchIdArg, deletedAt: null } })
    : await prisma.watch.findMany({
        where: {
          deletedAt: null,
          videoUrl: { contains: 'res.cloudinary.com' },
        },
        select: { id: true, sku: true, videoUrl: true },
      });

  if (!watches.length) {
    console.log('No hay videos para migrar.');
    return;
  }

  console.log(`Migrando ${watches.length} video(s)...`);
  let ok = 0;
  let failed = 0;

  for (const watch of watches) {
    try {
      await migrateWatch(watch);
      ok += 1;
    } catch (error) {
      failed += 1;
      console.error(`  ✕ ${watch.sku}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Listo. OK=${ok} Fallidos=${failed}${dryRun ? ' (dry-run)' : ''}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
