import {
  MAX_BULK_DRAFT_PHOTOS,
  MAX_WATCH_IMAGE_BYTES,
} from '../constants.js';

export type PhotoSortSource = 'createdAt' | 'modifiedAt' | 'none';

export type PhotoPairInput = {
  name: string;
  size: number;
  mime?: string;
  /** Modificación en ms (ZIP: NTFS o DOS). En fotos sueltas el navegador solo da `File.lastModified`. */
  modifiedAt?: number;
  /** Creación NTFS en ms, al guardar el archivo en la carpeta. Si falta, se ordena por modifiedAt. */
  createdAt?: number;
};

export const ZIP_NO_CREATED_AT_WARNING =
  'Este ZIP no trae horas de creación de Windows (NTFS). Es lo habitual si se comprimió con 7-Zip, en Mac u otro programa, y el orden de los pares puede quedar mal. Vuelve a comprimirlo con el Explorador de Windows: clic derecho en la carpeta → Enviar a → Carpeta comprimida.';

export function partialCreatedAtWarning(names: readonly string[]): string {
  return `Estas fotos no traen hora de creación NTFS y se ordenaron por su fecha de modificación: ${names.join(', ')}.`;
}

export type PhotoPairError = {
  fileName: string;
  message: string;
};

export type PhotoPair<T> = {
  front: T;
  back: T;
  idempotencyKey: string;
};

const IMAGE_BY_MIME: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

const IMAGE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function compareNaturalNames(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

function hasSortMs(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Hora usada para ordenar: creación NTFS y, si no existe, modificación. */
export function photoSortStamp(file: PhotoPairInput): { ms?: number; source: PhotoSortSource } {
  if (hasSortMs(file.createdAt)) return { ms: file.createdAt, source: 'createdAt' };
  if (hasSortMs(file.modifiedAt)) return { ms: file.modifiedAt, source: 'modifiedAt' };
  return { source: 'none' };
}

/**
 * Más antigua primero, en milisegundos.
 * Empate o sin hora: se conserva el orden de entrada (el sort de JS es estable).
 */
export function comparePhotoOrder(a: PhotoPairInput, b: PhotoPairInput): number {
  const aTime = photoSortStamp(a).ms;
  const bTime = photoSortStamp(b).ms;
  if (aTime !== undefined && bTime !== undefined && aTime !== bTime) return aTime - bTime;
  return 0;
}

/** Archivos sin creación NTFS, ya en el orden en que se emparejan. */
export function summarizePhotoCreatedAt<T extends PhotoPairInput>(files: readonly T[]) {
  const missing = [...files]
    .sort(comparePhotoOrder)
    .filter((file) => !hasSortMs(file.createdAt))
    .map((file) => file.name);
  return {
    missing,
    none: files.length > 0 && missing.length === files.length,
  };
}

export function imageKind(name: string, mime?: string): string | null {
  const normalized = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalized && IMAGE_BY_MIME[normalized]) return IMAGE_BY_MIME[normalized];
  const base = name.split(/[/\\]/).pop() ?? name;
  const ext = base.includes('.') ? base.split('.').pop()?.toLowerCase() ?? '' : '';
  return IMAGE_BY_EXT[ext] ?? null;
}

export function bulkDraftIdempotencyKey(
  batchId: string,
  frontName: string,
  backName: string,
): string {
  const raw = `${batchId}:${frontName}|${backName}`;
  if (raw.length <= 500) return raw;
  return `${batchId}:${fnv32(frontName)}|${fnv32(backName)}`;
}

function fnv32(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function planPhotoPairs<T extends PhotoPairInput>(
  files: readonly T[],
  batchId: string,
  maxBytes = MAX_WATCH_IMAGE_BYTES,
): { pairs: PhotoPair<T>[]; errors: PhotoPairError[] } {
  const ordered = [...files].sort(comparePhotoOrder);
  const errors: PhotoPairError[] = [];

  if (!ordered.length) {
    return {
      pairs: [],
      errors: [{ fileName: '', message: 'No hay fotos para emparejar.' }],
    };
  }

  if (ordered.length > MAX_BULK_DRAFT_PHOTOS) {
    const overflow = ordered[MAX_BULK_DRAFT_PHOTOS];
    errors.push({
      fileName: overflow?.name ?? '',
      message: `${overflow?.name ?? 'lote'}: el lote admite como máximo ${MAX_BULK_DRAFT_PHOTOS} fotos (250 relojes).`,
    });
  }

  if (ordered.length % 2 !== 0) {
    const last = ordered[ordered.length - 1];
    errors.push({
      fileName: last?.name ?? '',
      message: `${last?.name ?? 'lote'}: la cantidad de fotos debe ser par (frente y dorso).`,
    });
  }

  for (const file of ordered) {
    if (!imageKind(file.name, file.mime)) {
      errors.push({
        fileName: file.name,
        message: `${file.name}: solo se permiten JPEG, PNG o WEBP.`,
      });
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      errors.push({
        fileName: file.name,
        message: `${file.name}: el archivo está vacío.`,
      });
    } else if (file.size > maxBytes) {
      errors.push({
        fileName: file.name,
        message: `${file.name}: pesa más de 10 MB.`,
      });
    }
  }

  if (errors.length) return { pairs: [], errors };

  const pairs: PhotoPair<T>[] = [];
  for (let index = 0; index < ordered.length; index += 2) {
    const front = ordered[index];
    const back = ordered[index + 1];
    if (!front || !back) continue;
    pairs.push({
      front,
      back,
      idempotencyKey: bulkDraftIdempotencyKey(batchId, front.name, back.name),
    });
  }
  return { pairs, errors: [] };
}

export type BulkDraftSideFields = {
  batchId: string;
  frontName: string;
  backName: string;
  idempotencyKey: string;
  frontSortAt?: number;
  backSortAt?: number;
  frontSortSource: PhotoSortSource;
  backSortSource: PhotoSortSource;
  frontUrl?: string;
  backUrl?: string;
};

export function swapBulkDraftPairSides<T extends BulkDraftSideFields>(pair: T): T {
  const frontName = pair.backName;
  const backName = pair.frontName;
  return {
    ...pair,
    frontName,
    backName,
    frontSortAt: pair.backSortAt,
    backSortAt: pair.frontSortAt,
    frontSortSource: pair.backSortSource,
    backSortSource: pair.frontSortSource,
    frontUrl: pair.backUrl,
    backUrl: pair.frontUrl,
    idempotencyKey: bulkDraftIdempotencyKey(pair.batchId, frontName, backName),
  };
}

export function swapBulkDraftStoredSides<T extends {
  front: unknown;
  back: unknown;
  frontType: string;
  backType: string;
}>(stored: T): T {
  return {
    ...stored,
    front: stored.back as T['front'],
    back: stored.front as T['front'],
    frontType: stored.backType,
    backType: stored.frontType,
  };
}
