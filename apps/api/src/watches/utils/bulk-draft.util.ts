import { MAX_WATCH_IMAGE_BYTES } from '@luxtime/shared';

export const BULK_DRAFT_IDEMPOTENCY_FIELD = 'bulkDraftIdempotencyKey';

export const BULK_DRAFT_THROTTLE = {
  default: { limit: 60, ttl: 60_000 },
} as const;

export const BULK_DRAFT_UPLOAD_LIMITS = {
  fileSize: MAX_WATCH_IMAGE_BYTES,
  files: 2,
} as const;
