const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function readJwtSecret(value: string | undefined): string {
  const secret = value?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET no está configurado');
  }
  return secret;
}

export function readTokenDuration(
  value: string | undefined,
  fallback: string,
): { expiresIn: string; maxAgeMs: number } {
  const parsed = parseDuration(value) ?? parseDuration(fallback);
  if (!parsed) return { expiresIn: '15m', maxAgeMs: 15 * 60 * 1000 };
  return parsed;
}

function parseDuration(value: string | undefined): { expiresIn: string; maxAgeMs: number } | null {
  const source = value?.trim() ?? '';
  if (!source) return null;

  const unit = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i.exec(source);
  if (unit) {
    const amount = Number(unit[1]);
    const name = unit[2].toLowerCase();
    const maxAgeMs = Math.round(amount * UNIT_MS[name]);
    if (maxAgeMs > 0) return { expiresIn: `${amount}${name}`, maxAgeMs };
    return null;
  }

  if (/^\d+$/.test(source)) {
    const seconds = Number(source);
    if (seconds > 0) return { expiresIn: `${seconds}s`, maxAgeMs: seconds * 1000 };
  }

  return null;
}
