const TECHNICAL_PATTERNS = [
  /^\[(?:GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\]/i,
  /https?:\/\//i,
  /\bFetchError\b/i,
  /\bat\s+[\w./<>]+\(/,
  /ECONNREFUSED/i,
  /network error/i,
  /\[object Object\]/i,
];

function looksTechnical(msg: string): boolean {
  const trimmed = msg.trim();
  if (!trimmed || trimmed.length > 300) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function pickSafeMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed && !looksTechnical(trimmed) ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const picked = pickSafeMessage(item);
      if (picked) return picked;
    }
    return null;
  }

  if (value && typeof value === 'object' && 'message' in value) {
    return pickSafeMessage((value as { message: unknown }).message);
  }

  return null;
}

function readStatus(source: unknown): number | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const status = (source as { statusCode?: number; status?: number }).statusCode
    ?? (source as { status?: number }).status;
  return typeof status === 'number' ? status : undefined;
}

function statusFallback(status: number | undefined, fallback: string): string {
  if (status === 401) return 'Credenciales incorrectas o sesión expirada.';
  if (status === 403) return 'No tienes permiso para realizar esta acción.';
  if (status === 404) return 'Recurso no encontrado.';
  if (status === 413) return 'Los archivos pesan demasiado para el servidor. Usa fotos más livianas y un video corto (máx. ~25 MB en total).';
  if (status && status >= 500) return fallback;
  return fallback;
}

export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;

  const data = 'data' in err ? (err as { data?: unknown }).data : undefined;
  const fromData = pickSafeMessage(data);
  if (fromData) return fromData;

  const statusMessage = pickSafeMessage(
    data && typeof data === 'object' && 'statusMessage' in data
      ? (data as { statusMessage: unknown }).statusMessage
      : ('statusMessage' in err ? (err as { statusMessage: unknown }).statusMessage : null),
  );
  if (statusMessage) return statusMessage;

  const status = readStatus(err) ?? readStatus(data);
  return statusFallback(status, fallback);
}

export function isBadRequest(err: unknown) {
  return readStatus(err) === 400;
}
