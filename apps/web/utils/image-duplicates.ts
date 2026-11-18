import type { StoredImageDuplicate } from '@luxtime/shared';
import { resolveMediaUrl } from '~/utils/media-url';

export type DuplicateHitView = {
  key: string;
  thumb?: string;
  title: string;
  href?: string;
  detail: string;
};

function slotLabel(slot: string) {
  if (slot === 'front') return 'Frente';
  if (slot === 'back') return 'Dorso';
  if (slot.startsWith('gallery')) return 'Galería';
  return 'Foto';
}

export function storedDuplicateViews(
  hits: StoredImageDuplicate[],
  assetsBaseUrl: string,
): DuplicateHitView[] {
  return hits.map((hit) => ({
    key: `${hit.watchId}:${hit.slot}:${hit.imageUrl}`,
    thumb: resolveMediaUrl(hit.imageUrl, assetsBaseUrl),
    title: `${hit.sku} · ${hit.model}`,
    href: `/admin/inventario?reloj=${encodeURIComponent(hit.watchId)}`,
    detail: hit.kind === 'exact'
      ? `${slotLabel(hit.slot)} · misma foto`
      : `${slotLabel(hit.slot)} · muy parecida`,
  }));
}
