import { Prisma } from '@prisma/client';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterMs(attempt: number): number {
  const base = 25 * 2 ** Math.min(attempt, 5);
  return base + Math.floor(Math.random() * 40);
}

function targetIncludes(
  target: unknown,
  needles: string[],
): boolean {
  const parts = Array.isArray(target)
    ? target.map(String)
    : [String(target ?? '')];
  return parts.some((part) =>
    needles.some((needle) => part.toLowerCase().includes(needle.toLowerCase())),
  );
}

/** Errores transitorios de concurrencia / pool / unicidad de consecutivos. */
export function isTransientTxnError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034' || error.code === 'P2024') return true;
    if (
      error.code === 'P2002' &&
      targetIncludes(error.meta?.target, [
        'readableId',
        'number',
        'sequence',
      ])
    ) {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/\b40P01\b/i.test(message) || /\b40001\b/.test(message)) return true;
  if (/serialization failure|deadlock detected/i.test(message)) return true;
  return false;
}

/**
 * Reintenta toda la operación (nunca continúa una tx Postgres ya abortada).
 * Solo para conflictos de unicidad de consecutivos, serialización y pool.
 */
export async function withTxnRetries<T>(
  run: () => Promise<T>,
  options?: { maxAttempts?: number },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 10;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isTransientTxnError(error) || attempt >= maxAttempts - 1) {
        throw error;
      }
      await sleep(jitterMs(attempt));
    }
  }
  throw lastError;
}
