export function normalizeSkuSearch(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function matchesSkuSearch(sku: string, term: string): boolean {
  const normalizedTerm = normalizeSkuSearch(term);
  if (!normalizedTerm) return false;
  return normalizeSkuSearch(sku).includes(normalizedTerm);
}
