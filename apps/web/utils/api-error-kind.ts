/** Clasifica errores de fetch para no tratar fallos de red como sesión inválida. */

export function httpStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const status = (err as { statusCode?: number; status?: number }).statusCode
    ?? (err as { status?: number }).status;
  return typeof status === 'number' && status > 0 ? status : null;
}

export function isUnauthorizedError(err: unknown) {
  const status = httpStatus(err);
  return status === 401;
}

export function isForbiddenError(err: unknown) {
  const status = httpStatus(err);
  return status === 403;
}

export function isAuthRejectedError(err: unknown) {
  return isUnauthorizedError(err) || isForbiddenError(err);
}

/** Sin respuesta, timeout, DNS, CORS, 5xx o status desconocido. */
export function isTransientRequestError(err: unknown) {
  if (!err || typeof err !== 'object') return true;
  const status = httpStatus(err);
  if (status == null) return true;
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
}
