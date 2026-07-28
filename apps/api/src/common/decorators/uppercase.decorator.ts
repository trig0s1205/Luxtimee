import { Transform } from 'class-transformer';

function normalizeUpper(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : '';
}

function normalizeUpperOptional(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : undefined;
}

export function Uppercase() {
  return Transform(({ value }) => normalizeUpper(value));
}

export function UppercaseOptional() {
  return Transform(({ value }) => normalizeUpperOptional(value));
}
