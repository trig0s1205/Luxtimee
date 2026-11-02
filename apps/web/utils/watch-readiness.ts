const DRAFT_WATCH_MODEL = 'Pendiente de completar';

type ReadyWatch = {
  model?: string | null;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  stock?: number | null;
  categoryId?: string | null;
  category?: { id?: string } | null;
  gender?: string | null;
  description?: string | null;
  movementType?: string | null;
  mechanismId?: string | null;
  mechanism?: { id?: string } | null;
  primaryImageUrl?: string | null;
  secondaryImageUrl?: string | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  videoUrl?: string | null;
  images?: string[] | null;
};

/** Ficha que no puede venderse: falta modelo, precio, fotos, video u otro dato del catálogo. */
export function isWatchIncomplete(watch: ReadyWatch) {
  const model = (watch.model ?? '').trim();
  if (!model || model === DRAFT_WATCH_MODEL) return true;
  if (!watch.categoryId && !watch.category?.id) return true;
  if (!watch.gender?.trim()) return true;
  if (!watch.description?.trim()) return true;
  if (!watch.retailPrice || watch.retailPrice <= 0) return true;
  if (!watch.wholesalePrice || watch.wholesalePrice <= 0) return true;
  if (watch.stock == null || watch.stock < 0) return true;
  const hasPrimary = !!(watch.primaryImageUrl || watch.frontImageUrl || watch.images?.[0]);
  const hasSecondary = !!(watch.secondaryImageUrl || watch.backImageUrl || watch.images?.[1]);
  if (!hasPrimary || !hasSecondary) return true;
  if (!watch.videoUrl?.trim()) return true;
  if (!watch.movementType?.trim() && !watch.mechanismId && !watch.mechanism?.id) return true;
  return false;
}
