/**
 * Huellas (SHA-256 + dHash) de fotos ya guardadas.
 *
 *   pnpm --filter @luxtime/api fingerprints:backfill
 *   pnpm --filter @luxtime/api fingerprints:backfill -- --apply
 *   pnpm --filter @luxtime/api fingerprints:backfill -- --apply --allow-remote-images
 *
 * Dry-run por defecto: no descarga ni escribe.
 * --apply lee archivos locales (/uploads o localhost). No llama a Cloudinary
 * salvo que se pase --allow-remote-images.
 * Idempotente: si la fila ya tiene ambos hashes, se omite.
 * Rechaza cualquier DATABASE_URL que no sea localhost.
 */
import { existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { runImageFingerprintBackfill } from '../../src/watches/backfill-image-fingerprints';
import { assertLocalDatabaseUrl } from '../../src/watches/local-database';

function loadEnvFile() {
  const envPath = resolve(__dirname, '../../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

if (process.env.DIRECT_URL) {
  const direct = process.env.DIRECT_URL;
  assertLocalDatabaseUrl(direct);
  process.env.DATABASE_URL = direct;
}

assertLocalDatabaseUrl(process.env.DATABASE_URL);

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');
const allowRemoteImages = process.argv.includes('--allow-remote-images');
const prisma = new PrismaClient();

function localPath(imageUrl: string): string | null {
  if (imageUrl.startsWith('/uploads/')) {
    return resolve(process.cwd(), imageUrl.replace(/^\//, ''));
  }
  try {
    const parsed = new URL(imageUrl);
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
      && parsed.pathname.startsWith('/uploads/')
    ) {
      return resolve(process.cwd(), parsed.pathname.replace(/^\//, ''));
    }
  } catch {
    return null;
  }
  return null;
}

async function readBytes(imageUrl: string): Promise<Uint8Array | null> {
  const path = localPath(imageUrl);
  if (path) {
    if (!existsSync(path)) return null;
    return new Uint8Array(await readFile(path));
  }
  if (!allowRemoteImages) return null;
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
}

async function main() {
  const summary = await runImageFingerprintBackfill({
    prisma,
    apply,
    force,
    allowRemoteImages,
    readBytes: apply ? readBytes : undefined,
    log: (line) => console.log(line),
  });
  console.log(
    [
      apply ? 'apply' : 'dry-run',
      `pendientes=${summary.pending}`,
      `actualizadas=${summary.updated}`,
      `ya listas=${summary.skipped}`,
      `remotas omitidas=${summary.remoteSkipped}`,
      `fallidas=${summary.failed}`,
    ].join(' '),
  );
  if (!apply) {
    console.log(
      'Nada se escribió. En esta base local: pnpm --filter @luxtime/api fingerprints:backfill -- --apply',
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
