import {
  MAX_BULK_DRAFT_PHOTOS,
  MAX_WATCH_IMAGE_BYTES,
} from '../constants.js';

export type PhotoPairInput = {
  name: string;
  size: number;
  mime?: string;
  modifiedAt?: number;
};

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

function hasModifiedAt(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function comparePhotoOrder(a: PhotoPairInput, b: PhotoPairInput): number {
  const aTime = a.modifiedAt;
  const bTime = b.modifiedAt;
  if (hasModifiedAt(aTime) && hasModifiedAt(bTime) && aTime !== bTime) return aTime - bTime;
  return 0;
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
