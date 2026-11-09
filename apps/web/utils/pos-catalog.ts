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
