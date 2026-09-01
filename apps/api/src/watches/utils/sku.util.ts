export type SkuTierPrefix = 'RM' | 'RA' | 'RP' | 'RD';

const SKU_MEDIA_MAX = 70_000;
const SKU_ALTA_MAX = 100_000;

export function resolveSkuPrefix(retailPrice: number, gender?: string | null): SkuTierPrefix {
  if (gender?.trim().toLowerCase() === 'mujer') return 'RD';
  if (retailPrice <= SKU_MEDIA_MAX) return 'RM';
  if (retailPrice <= SKU_ALTA_MAX) return 'RA';
  return 'RP';
}

export function formatWatchSku(prefix: SkuTierPrefix, sequence: number): string {
  return `${prefix}-${sequence}`;
}
