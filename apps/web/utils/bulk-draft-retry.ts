export const BULK_DRAFT_MISSING_PHOTO =
  'Falta la foto en este navegador. Quite la fila y vuelva a elegir el par.';

export const BULK_DRAFT_QUOTA_MESSAGE =
  'El navegador no tiene espacio: suba un lote más pequeño (máx. ~40 fotos)';

export const BULK_DRAFT_RETRY_BASE_MS = [2_000, 4_000, 8_000, 16_000, 30_000] as const;

export const BULK_DRAFT_MAX_TRANSIENT_RETRIES = BULK_DRAFT_RETRY_BASE_MS.length;

export type BulkDraftRetryDecision =
  | { action: 'pause' }
  | { action: 'retry'; delayMs: number }
  | { action: 'fail' };

export function bulkDraftRetryDelayMs(attempt: number, random = 0): number {
  const base = BULK_DRAFT_RETRY_BASE_MS[Math.min(Math.max(attempt, 0), BULK_DRAFT_RETRY_BASE_MS.length - 1)]
    ?? BULK_DRAFT_RETRY_BASE_MS[BULK_DRAFT_RETRY_BASE_MS.length - 1];
  const unit = Math.min(1, Math.max(0, random));
  return base + Math.floor(unit * base * 0.2);
}

export function decideBulkDraftRetry(input: {
  attempt: number;
  offline?: boolean;
  status?: number;
  errorName?: string;
  isTypeError?: boolean;
}, random = 0): BulkDraftRetryDecision {
  const retryable = input.isTypeError === true
    || input.errorName === 'TimeoutError'
    || input.errorName === 'AbortError'
    || (typeof input.status === 'number' && input.status >= 500);
  if (input.offline && (retryable || input.status === undefined)) return { action: 'pause' };
  if (!retryable || input.attempt >= BULK_DRAFT_MAX_TRANSIENT_RETRIES) return { action: 'fail' };
  return { action: 'retry', delayMs: bulkDraftRetryDelayMs(input.attempt, random) };
}

export function bulkDraftPhotosMissing(stored: {
  front?: { size?: number } | null;
  back?: { size?: number } | null;
} | null | undefined): boolean {
  if (!stored?.front || stored.front.size === 0) return true;
  if (stored.back != null && (stored.back.size ?? 0) === 0) return true;
  return false;
}

function payloadText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload == null) return '';
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
}

export function bulkDraftUploadErrorMessage(status: number, payload: unknown): string | null {
  if (status !== 400) return null;
  if (!payloadText(payload).toLowerCase().includes('falta la imagen')) return null;
  return BULK_DRAFT_MISSING_PHOTO;
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  const code = (error as { code?: number }).code;
  return name === 'QuotaExceededError' || code === 22;
}
