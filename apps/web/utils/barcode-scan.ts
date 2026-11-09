export type ScanEvent =
  | { type: 'scan'; code: string }
  | { type: 'manual'; text: string };

export function looksLikeSku(text: string): boolean {
  return /^[A-Z]{2}-\d{3,}$/i.test(text.trim());
}

export function normalizeScannedCode(text: string): string {
  return text.trim().replace(/\s+/g, '').toUpperCase();
}

export function createScanDetector(options?: {
  maxInterKeyMs?: number;
  minLength?: number;
}) {
  const maxInterKeyMs = options?.maxInterKeyMs ?? 40;
  const minLength = options?.minLength ?? 3;
  let buffer = '';
  let lastAt = 0;
  let intervalsOk = true;

  function reset() {
    buffer = '';
    lastAt = 0;
    intervalsOk = true;
  }

  function push(key: string, at: number): ScanEvent | null {
    if (key === 'Backspace') {
      reset();
      return null;
    }
    if (key === 'Enter') {
      const text = buffer;
      const wasFast = intervalsOk && text.length >= minLength;
      reset();
      if (!text) return null;
      if (wasFast) return { type: 'scan', code: text };
      return { type: 'manual', text };
    }
    if (key.length !== 1) return null;
    if (lastAt && at - lastAt > 400) {
      reset();
    }
    if (lastAt && at - lastAt > maxInterKeyMs) {
      intervalsOk = false;
    }
    buffer += key;
    lastAt = at;
    return null;
  }

  return { push, reset };
}
