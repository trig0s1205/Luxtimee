import { sanitizePlainText } from '../common/utils/sanitize-text.util';

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizeNameKey(value: string): string {
  return stripAccents(sanitizePlainText(value, 200))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Neutraliza fórmulas peligrosas si el valor se reexporta. */
export function neutralizeSpreadsheetText(value: string): string {
  const cleaned = sanitizePlainText(value, 5000);
  if (/^[=+\-@]/.test(cleaned)) return `'${cleaned}`;
  return cleaned;
}

export function parseSiNo(raw: string | undefined): boolean | undefined {
  if (raw == null || !String(raw).trim()) return undefined;
  const v = normalizeNameKey(String(raw));
  if (['si', 'sí', 'yes', 'true', '1'].includes(v)) return true;
  if (['no', 'false', '0'].includes(v)) return false;
  return undefined;
}

export function parseIntField(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  const s = String(raw).replace(/[^\d-]/g, '').trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** Distancia de Levenshtein acotada (sugerencias). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

export function closestName(
  needle: string,
  candidates: string[],
  maxDistance = 4,
): string | null {
  const key = normalizeNameKey(needle);
  if (!key) return null;
  let best: string | null = null;
  let bestDist = maxDistance + 1;
  for (const c of candidates) {
    const d = editDistance(key, normalizeNameKey(c));
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= maxDistance ? best : null;
}
