/** Badge de stock del POS. */
export function stockBadge(stock: number): string {
  if (stock === 1) return 'Última unidad';
  return `Quedan ${stock}`;
}

/** Texto de garantía en español de Colombia. */
export function warrantyLabel(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return 'Sin garantía';
  if (months === 1) return '1 mes';
  return `${months} meses`;
}

/** Iniciales para placeholder de foto rota/ausente. */
export function photoInitials(brandName: string, model: string): string {
  const brand = brandName.trim().charAt(0);
  const modelPart = model.trim().charAt(0);
  const letters = `${brand}${modelPart}`.toUpperCase();
  return letters || '?';
}

/**
 * Galería segura: gallery si tiene ítems, si no imageUrl, si no [].
 */
export function fallbackGallery(
  gallery: string[] | null | undefined,
  imageUrl: string | null | undefined,
): string[] {
  if (Array.isArray(gallery) && gallery.length) {
    return gallery.filter((url) => typeof url === 'string' && url.trim());
  }
  if (typeof imageUrl === 'string' && imageUrl.trim()) return [imageUrl.trim()];
  return [];
}

/** Números de página con elipsis: 1 2 3 … N */
export function catalogPageList(page: number, totalPages: number): Array<number | '…'> {
  const last = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), last);
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const wanted = [1, last, current - 1, current, current + 1].filter(
    (n) => n >= 1 && n <= last,
  );
  const unique = [...new Set(wanted)].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  for (let i = 0; i < unique.length; i += 1) {
    if (i > 0 && unique[i] - unique[i - 1] > 1) out.push('…');
    out.push(unique[i]);
  }
  return out;
}

/** Teléfono Colombia para wa.me. 10 dígitos → 57… */
export function whatsappPhoneCo(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `57${digits}`;
  if (digits.length === 12 && digits.startsWith('57')) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** Guarda data.items del catálogo POS. */
export function safeCatalogItems<T>(data: unknown): T[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export function hasActiveCatalogFilters(values: Array<string | number | null | undefined>) {
  return values.some((value) => {
    if (value == null) return false;
    if (typeof value === 'number') return Number.isFinite(value);
    return String(value).trim().length > 0;
  });
}
