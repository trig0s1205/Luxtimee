import type { CatalogListQuery } from '@luxtime/shared';

const FILTER_SKIP = new Set(['', 'all']);

const PLACEHOLDER_LABELS = new Set([
  'género',
  'genero',
  'gender',
  'marca',
  'brand',
  'mecanismo',
  'movement',
  'disponibilidad',
  'availability',
]);

export function normalizeFilterValue(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || FILTER_SKIP.has(trimmed.toLowerCase())) return undefined;
  if (PLACEHOLDER_LABELS.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export function normalizeGender(value?: string | null) {
  const normalized = normalizeFilterValue(value);
  if (!normalized) return undefined;
  const map: Record<string, string> = {
    hombre: 'Hombre',
    mujer: 'Mujer',
    unisex: 'Unisex',
  };
  return map[normalized.toLowerCase()] ?? normalized;
}

export function sanitizeCatalogQuery(query: CatalogListQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  if (query.sort) params.sort = query.sort;
  if (query.page) params.page = query.page;
  if (query.limit) params.limit = query.limit;

  const brand = normalizeFilterValue(query.brand);
  if (brand) params.brand = brand;

  const movement = normalizeFilterValue(query.movement);
  if (movement) params.movement = movement;

  const gender = normalizeGender(query.gender);
  if (gender) params.gender = gender;

  const available = normalizeFilterValue(query.available);
  if (available) params.available = available;

  const search = query.search?.trim();
  if (search) params.search = search;

  if (query.minPrice !== undefined && query.minPrice >= 0) params.minPrice = query.minPrice;
  if (query.maxPrice !== undefined && query.maxPrice >= 0) params.maxPrice = query.maxPrice;

  return params;
}

function equalsInsensitive(a?: string | null, b?: string) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export { equalsInsensitive };
