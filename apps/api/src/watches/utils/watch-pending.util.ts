export const DRAFT_WATCH_MODEL = 'Pendiente de completar';

export type PendingFieldCode =
  | 'model'
  | 'category'
  | 'gender'
  | 'retailPrice'
  | 'wholesalePrice'
  | 'stock'
  | 'primaryImage'
  | 'secondaryImage'
  | 'video'
  | 'movement'
  | 'cost';

export interface PendingFieldDto {
  code: PendingFieldCode;
  label: string;
}

export type WatchPendingShape = {
  model: string;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  isPublished: boolean;
  categoryId?: string | null;
  gender?: string | null;
  movementType?: string | null;
  mechanismId?: string | null;
  primaryImageUrl?: string | null;
  secondaryImageUrl?: string | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  videoUrl?: string | null;
  images?: string[];
  cost?: number | null;
};

export function isWatchDraft(watch: WatchPendingShape): boolean {
  const model = (watch.model ?? '').trim();
  return (
    !watch.isPublished
    && watch.retailPrice === 0
    && watch.wholesalePrice === 0
    && (model === '' || model === DRAFT_WATCH_MODEL)
  );
}

function hasPrimaryImage(watch: WatchPendingShape): boolean {
  return !!(watch.primaryImageUrl || watch.frontImageUrl || watch.images?.[0]);
}

function hasSecondaryImage(watch: WatchPendingShape): boolean {
  return !!(watch.secondaryImageUrl || watch.backImageUrl || watch.images?.[1]);
}

export function getMissingGeneralFields(watch: WatchPendingShape): PendingFieldDto[] {
  const missing: PendingFieldDto[] = [];
  const model = (watch.model ?? '').trim();

  if (!model || model === DRAFT_WATCH_MODEL) {
    missing.push({ code: 'model', label: 'Modelo' });
  }
  if (!watch.categoryId) {
    missing.push({ code: 'category', label: 'Categoría' });
  }
  if (!watch.gender?.trim()) {
    missing.push({ code: 'gender', label: 'Género' });
  }
  if (!watch.retailPrice || watch.retailPrice <= 0) {
    missing.push({ code: 'retailPrice', label: 'Precio público' });
  }
  if (!watch.wholesalePrice || watch.wholesalePrice <= 0) {
    missing.push({ code: 'wholesalePrice', label: 'Precio mayorista' });
  }
  if (watch.stock == null || watch.stock < 0) {
    missing.push({ code: 'stock', label: 'Stock' });
  }
  if (!hasPrimaryImage(watch)) {
    missing.push({ code: 'primaryImage', label: 'Foto principal' });
  }
  if (!hasSecondaryImage(watch)) {
    missing.push({ code: 'secondaryImage', label: 'Foto secundaria' });
  }
  if (!watch.videoUrl?.trim()) {
    missing.push({ code: 'video', label: 'Video' });
  }
  const movement = (watch.movementType ?? '').trim();
  if (!movement && !watch.mechanismId) {
    missing.push({ code: 'movement', label: 'Movimiento' });
  }

  return missing;
}

export function getMissingCostFields(watch: WatchPendingShape): PendingFieldDto[] {
  if (watch.cost == null || watch.cost <= 0) {
    return [{ code: 'cost', label: 'Costo (COP)' }];
  }
  return [];
}

export function isWatchGeneralInfoComplete(watch: WatchPendingShape): boolean {
  if (getMissingGeneralFields(watch).length > 0) return false;
  return watch.stock > 0;
}
