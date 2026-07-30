/**
 * Strip HTML tags and dangerous control characters from free-text user input.
 * Defense-in-depth alongside Vue text interpolation (no v-html).
 */
export function sanitizePlainText(value: unknown, maxLength = 5000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizePlainTextOptional(
  value: unknown,
  maxLength = 5000,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = sanitizePlainText(value, maxLength);
  return cleaned.length ? cleaned : undefined;
}
