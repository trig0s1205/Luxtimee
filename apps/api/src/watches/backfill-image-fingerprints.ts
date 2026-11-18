import { PrismaClient } from '@prisma/client';
import { fingerprintImageBytes } from '@luxtime/shared';
import { imageSlotsFromWatch } from './image-slots';

export type BackfillSummary = {
  pending: number;
  updated: number;
  skipped: number;
  remoteSkipped: number;
  failed: number;
};

export async function runImageFingerprintBackfill(input: {
  prisma: PrismaClient;
  apply: boolean;
  force?: boolean;
  allowRemoteImages?: boolean;
  readBytes?: (imageUrl: string) => Promise<Uint8Array | null>;
  log?: (line: string) => void;
}): Promise<BackfillSummary> {
  const log = input.log ?? (() => undefined);
  const watches = await input.prisma.watch.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      images: true,
      frontImageUrl: true,
      backImageUrl: true,
      primaryImageUrl: true,
      secondaryImageUrl: true,
      imageFingerprints: {
        select: { imageUrl: true, contentHash: true, perceptualHash: true },
      },
    },
  });

  const summary: BackfillSummary = {
    pending: 0,
    updated: 0,
    skipped: 0,
    remoteSkipped: 0,
    failed: 0,
  };

  for (const watch of watches) {
    const known = new Map(
      watch.imageFingerprints.map((row) => [row.imageUrl, row]),
    );
    for (const slot of imageSlotsFromWatch(watch)) {
      const current = known.get(slot.imageUrl);
      const complete = Boolean(current?.contentHash && current?.perceptualHash);
      if (complete && !input.force) {
        summary.skipped += 1;
        continue;
      }
      if (!input.apply) {
        summary.pending += 1;
        log(`pendiente ${watch.id} ${slot.slot} ${slot.imageUrl}`);
        continue;
      }
      if (isRemoteUrl(slot.imageUrl) && !input.allowRemoteImages) {
        summary.remoteSkipped += 1;
        log(`omitida remota ${slot.imageUrl}`);
        continue;
      }
      try {
        const bytes = await input.readBytes?.(slot.imageUrl);
        if (!bytes?.length) {
          summary.failed += 1;
          log(`sin bytes ${slot.imageUrl}`);
          continue;
        }
        const fingerprint = await fingerprintImageBytes(bytes);
        await input.prisma.watchImageFingerprint.upsert({
          where: {
            watchId_imageUrl: { watchId: watch.id, imageUrl: slot.imageUrl },
          },
          create: {
            watchId: watch.id,
            imageUrl: slot.imageUrl,
            slot: slot.slot,
            contentHash: fingerprint.contentHash,
            perceptualHash: fingerprint.perceptualHash,
          },
          update: {
            slot: slot.slot,
            contentHash: fingerprint.contentHash,
            perceptualHash: fingerprint.perceptualHash,
          },
        });
        summary.updated += 1;
      } catch (error) {
        summary.failed += 1;
        log(
          `falló ${slot.imageUrl}: ${error instanceof Error ? error.message : 'error'}`,
        );
      }
    }
  }

  return summary;
}

function isRemoteUrl(imageUrl: string) {
  if (imageUrl.startsWith('/uploads/')) return false;
  try {
    const parsed = new URL(imageUrl);
    return parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1';
  } catch {
    return false;
  }
}
