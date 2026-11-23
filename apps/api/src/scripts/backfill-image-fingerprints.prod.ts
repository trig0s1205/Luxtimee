/**
 * Huellas en producción (imagen Docker, node dist/scripts/...).
 * Por defecto dry-run: no descarga ni escribe.
 * --apply solo escribe si CONFIRM_PROD_FINGERPRINTS=SI.
 * Solo descarga https de res.cloudinary.com (o el host configurado).
 */
import { PrismaClient } from '@prisma/client';
import { runImageFingerprintBackfill } from '../watches/backfill-image-fingerprints';
import {
  assertProductionApplyAllowed,
  downloadCloudinaryImage,
  isAllowedCloudinaryImageUrl,
} from './fingerprint-backfill-prod';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function printSummary(
  apply: boolean,
  summary: Awaited<ReturnType<typeof runImageFingerprintBackfill>>,
) {
  if (!apply) {
    console.log(
      [
        'dry-run',
        `total de huecos=${summary.total}`,
        `ya con huella=${summary.skipped}`,
        `pendientes=${summary.pending}`,
      ].join(' '),
    );
    console.log('Nada se escribió ni se descargó.');
    return;
  }
  console.log(
    [
      'apply',
      `actualizadas=${summary.updated}`,
      `ya listas=${summary.skipped}`,
      `omitidas=${summary.remoteSkipped}`,
      `fallidas=${summary.failed}`,
    ].join(' '),
  );
  if (summary.failedUrls.length) {
    console.log('URLs fallidas:');
    for (const url of summary.failedUrls) console.log(url);
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  assertProductionApplyAllowed(apply, process.env.CONFIRM_PROD_FINGERPRINTS);
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL.');
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const prisma = new PrismaClient();
  try {
    const summary = await runImageFingerprintBackfill({
      prisma,
      apply,
      allowRemoteImages: apply,
      acceptRemoteUrl: (imageUrl) =>
        isAllowedCloudinaryImageUrl(imageUrl, cloudName),
      readBytes: apply
        ? async (imageUrl) => {
            await delay(200);
            return downloadCloudinaryImage(imageUrl, cloudName);
          }
        : undefined,
      onProgress: (processed) => {
        if (processed % 25 === 0) {
          console.log(`progreso ${processed} imágenes`);
        }
      },
      log: (line) => {
        if (line.startsWith('pendiente ')) return;
        console.log(line);
      },
    });
    printSummary(apply, summary);
    if (apply && summary.failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
