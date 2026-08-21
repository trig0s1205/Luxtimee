import type { HomepageCustomerProofImage } from '@luxtime/shared';

export function normalizeCustomerProofImages(raw: unknown): HomepageCustomerProofImage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): HomepageCustomerProofImage | null => {
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { url } : null;
      }
      if (item && typeof item === 'object' && 'url' in item) {
        const url = String((item as { url: unknown }).url ?? '').trim();
        const captionRaw = (item as { caption?: unknown }).caption;
        const caption = typeof captionRaw === 'string' ? captionRaw.trim() : '';
        return url ? { url, ...(caption ? { caption } : {}) } : null;
      }
      return null;
    })
    .filter((item): item is HomepageCustomerProofImage => item !== null);
}
