export type WatchImageFields = {
  primaryImageUrl?: string | null;
  secondaryImageUrl?: string | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  images?: string[] | null;
};

export type AssignedWatchImages = {
  primaryImageUrl: string;
  secondaryImageUrl: string;
  frontImageUrl: string;
  backImageUrl: string;
  images: string[];
  mainImageIndex: number;
  fingerprintSlots: Array<{ imageUrl: string; slot: 'front' | 'back' }>;
};

function ownedUrls(watch: WatchImageFields): Set<string> {
  return new Set(
    [
      watch.primaryImageUrl,
      watch.secondaryImageUrl,
      watch.frontImageUrl,
      watch.backImageUrl,
      ...(watch.images ?? []),
    ].filter((url): url is string => !!url),
  );
}

export function assignExistingWatchImages(
  existing: WatchImageFields,
  primaryImageUrl?: string | null,
  secondaryImageUrl?: string | null,
): AssignedWatchImages {
  const allowed = ownedUrls(existing);
  const primary = primaryImageUrl ?? existing.primaryImageUrl ?? existing.frontImageUrl ?? existing.images?.[0] ?? '';
  const secondary = secondaryImageUrl ?? existing.secondaryImageUrl ?? existing.backImageUrl ?? existing.images?.[1] ?? '';
  if (primary && !allowed.has(primary)) {
    throw new Error('La foto principal no pertenece a este reloj');
  }
  if (secondary && !allowed.has(secondary)) {
    throw new Error('La foto secundaria no pertenece a este reloj');
  }
  const images = [primary, secondary].filter(Boolean);
  return {
    primaryImageUrl: primary,
    secondaryImageUrl: secondary,
    frontImageUrl: primary,
    backImageUrl: secondary,
    images,
    mainImageIndex: 0,
    fingerprintSlots: [
      ...(primary ? [{ imageUrl: primary, slot: 'front' as const }] : []),
      ...(secondary ? [{ imageUrl: secondary, slot: 'back' as const }] : []),
    ],
  };
}
