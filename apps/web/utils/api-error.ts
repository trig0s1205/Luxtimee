export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;

  const candidates: unknown[] = [];

  if ('data' in err) candidates.push((err as { data?: unknown }).data);
  candidates.push(err);

  for (const source of candidates) {
    if (!source || typeof source !== 'object') continue;

    const message = (source as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message) && message[0]) return String(message[0]);

    if (message && typeof message === 'object' && 'message' in message) {
      const nested = (message as { message?: unknown }).message;
      if (typeof nested === 'string' && nested.trim()) return nested;
      if (Array.isArray(nested) && nested[0]) return String(nested[0]);
    }

    const statusMessage = (source as { statusMessage?: unknown }).statusMessage;
    if (typeof statusMessage === 'string' && statusMessage.trim()) return statusMessage;
  }

  if ('message' in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg && msg !== '[object Object]') return msg;
  }

  return fallback;
}

export function isBadRequest(err: unknown) {
  return err
    && typeof err === 'object'
    && 'statusCode' in err
    && (err as { statusCode?: number }).statusCode === 400;
}
