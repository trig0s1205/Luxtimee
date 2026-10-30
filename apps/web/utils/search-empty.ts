export function searchEmptyMessage(options: {
  term: string;
  pending: boolean;
  count: number;
  message: string;
  minLength?: number;
}) {
  const minLength = options.minLength ?? 1;
  if (options.term.trim().length < minLength) return '';
  if (options.pending || options.count > 0) return '';
  return options.message;
}
