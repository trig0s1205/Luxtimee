export type SkuTierPrefix = 'RM' | 'RA' | 'RP' | 'RD';

// Límites en COP (miles)
const SKU_MEDIA_MAX = 80_000; // Hasta 80k = Gama Media (RM)
const SKU_ALTA_MAX = 100_000; // 80k-100k = Gama Alta (RA)
// Más de 100k = Premium (RP)

export function resolveSkuPrefix(
  retailPrice: number,
  gender?: string | null,
): SkuTierPrefix {
  const g = gender?.trim().toLowerCase();
  // Dama siempre es RD sin importar precio
  if (g === 'mujer' || g === 'dama') return 'RD';
  // Hombre y Unisex se clasifican por precio
  if (retailPrice <= SKU_MEDIA_MAX) return 'RM';
  if (retailPrice <= SKU_ALTA_MAX) return 'RA';
  return 'RP';
}

export function formatWatchSku(
  prefix: SkuTierPrefix,
  sequence: number,
): string {
  // Mínimo 3 dígitos (001, 002... 999, 1000, 1001...)
  const num = sequence.toString().padStart(3, '0');
  return `${prefix}-${num}`;
}
