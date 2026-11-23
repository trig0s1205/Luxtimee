import type { StoredImageDuplicate } from '@luxtime/shared';
import { resolveMediaUrl } from '~/utils/media-url';

export type DuplicateHitView = {
  key: string;
  thumb?: string;
  kind: 'exact' | 'near';
  caption?: string;
};

function kindOf(kind: StoredImageDuplicate['kind'] | 'exact' | 'perceptual'): DuplicateHitView['kind'] {
  return kind === 'exact' ? 'exact' : 'near';
}

export function storedDuplicateViews(
  hits: StoredImageDuplicate[],
  assetsBaseUrl: string,
): DuplicateHitView[] {
  return hits.map((hit) => ({
    key: `${hit.watchId}:${hit.slot}:${hit.imageUrl}`,
    thumb: resolveMediaUrl(hit.imageUrl, assetsBaseUrl),
    kind: kindOf(hit.kind),
    caption: hit.sku || hit.model || undefined,
  }));
}
