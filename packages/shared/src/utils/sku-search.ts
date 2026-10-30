export function normalizeSkuSearch(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function matchesSkuSearch(sku: string, term: string): boolean {
  const normalizedTerm = normalizeSkuSearch(term);
  if (!normalizedTerm) return false;
  return normalizeSkuSearch(sku).includes(normalizedTerm);
}

/** Variantes para `contains`: RM-489, rm 489 y RM489 encuentran el mismo código. */
export function skuSearchVariants(term: string): string[] {
  const raw = term.trim();
  const normalized = normalizeSkuSearch(raw);
  if (!raw && !normalized) return [];

  const variants = new Set<string>();
  if (raw) variants.add(raw);
  if (normalized) variants.add(normalized);

  const compact = normalized.match(/^([A-Z]{2})(\d+)$/);
  if (compact) {
    const prefix = compact[1];
    const digits = compact[2];
    variants.add(`${prefix}-${digits}`);
    const unpadded = String(Number.parseInt(digits, 10));
    if (unpadded !== digits) {
      variants.add(`${prefix}-${unpadded}`);
      variants.add(`${prefix}${unpadded}`);
    }
  }

  return [...variants];
}
