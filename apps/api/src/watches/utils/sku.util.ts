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

const SKU_CODE_PATTERN = /^([A-Z]{2})-(\d+)$/;

export function parseSkuSequence(sku: string): number | null {
  const match = sku.trim().toUpperCase().match(SKU_CODE_PATTERN);
  if (!match) return null;
  const value = Number.parseInt(match[2], 10);
  return Number.isFinite(value) ? value : null;
}

/** Nuevo código con el prefijo del precio/género y el mismo consecutivo. */
export function recomputeSkuKeepingSequence(
  currentSku: string,
  retailPrice: number,
  gender?: string | null,
): string | null {
  const sequence = parseSkuSequence(currentSku);
  if (sequence == null) return null;
  return formatWatchSku(resolveSkuPrefix(retailPrice, gender), sequence);
}

export type SkuRecomputeRow = {
  id: string;
  sku: string;
  retailPrice: number;
  gender?: string | null;
};

export type SkuRecomputePlan = {
  id: string;
  from: string;
  to: string;
  keptSequence: boolean;
};

/**
 * Plan de recálculo. Conserva el número si el código destino está libre.
 * Si choca con otro reloj, asigna el siguiente libre del prefijo nuevo.
 * No modifica SKUs que no siguen el patrón PREFIJO-número.
 */
export function planSkuRecompute(rows: SkuRecomputeRow[]): SkuRecomputePlan[] {
  const desired = rows.map((row) => {
    const next = recomputeSkuKeepingSequence(row.sku, row.retailPrice, row.gender);
    return { ...row, next };
  });

  const occupied = new Set(rows.map((row) => row.sku.toUpperCase()));
  for (const row of desired) {
    if (row.next && row.next !== row.sku.toUpperCase()) occupied.delete(row.sku.toUpperCase());
  }

  const plans: SkuRecomputePlan[] = [];
  const claimed = new Set<string>();
  const pending: typeof desired = [];
  const movers = desired
    .filter((row) => row.next && row.next !== row.sku.toUpperCase())
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const row of movers) {
    const next = row.next as string;
    if (!occupied.has(next) && !claimed.has(next)) {
      claimed.add(next);
      occupied.add(next);
      plans.push({ id: row.id, from: row.sku, to: next, keptSequence: true });
    } else {
      pending.push(row);
    }
  }

  const maxByPrefix = new Map<string, number>();
  const consider = (sku: string) => {
    const match = sku.toUpperCase().match(SKU_CODE_PATTERN);
    if (!match) return;
    const value = Number.parseInt(match[2], 10);
    const current = maxByPrefix.get(match[1]) ?? 0;
    if (value > current) maxByPrefix.set(match[1], value);
  };
  for (const sku of occupied) consider(sku);
  for (const sku of claimed) consider(sku);

  for (const row of pending) {
    const prefix = resolveSkuPrefix(row.retailPrice, row.gender);
    let sequence = (maxByPrefix.get(prefix) ?? 0) + 1;
    let sku = formatWatchSku(prefix, sequence);
    while (occupied.has(sku) || claimed.has(sku)) {
      sequence += 1;
      sku = formatWatchSku(prefix, sequence);
    }
    maxByPrefix.set(prefix, sequence);
    claimed.add(sku);
    occupied.add(sku);
    plans.push({ id: row.id, from: row.sku, to: sku, keptSequence: false });
  }

  return plans;
}
