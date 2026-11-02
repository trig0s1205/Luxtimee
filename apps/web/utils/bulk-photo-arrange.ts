import { compareNaturalNames } from '@luxtime/shared';

export type PhotoRole = 'frente' | 'dorso';

export function sortByNaturalName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareNaturalNames(a.name, b.name));
}

export function selectionBadge(orderIndex: number): { n: number; role: PhotoRole } {
  return {
    n: orderIndex + 1,
    role: orderIndex % 2 === 0 ? 'frente' : 'dorso',
  };
}

export function toggleSelection(selected: readonly string[], id: string): string[] {
  const index = selected.indexOf(id);
  if (index === -1) return [...selected, id];
  return selected.filter((item) => item !== id);
}

export function pairInOrder<T>(items: readonly T[]): {
  pairs: Array<{ front: T; back: T }>;
  leftover: T | null;
} {
  const pairs: Array<{ front: T; back: T }> = [];
  for (let index = 0; index + 1 < items.length; index += 2) {
    const front = items[index];
    const back = items[index + 1];
    if (front !== undefined && back !== undefined) pairs.push({ front, back });
  }
  const leftover = items.length % 2 === 1 ? (items[items.length - 1] ?? null) : null;
  return { pairs, leftover };
}

export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (index < 0 || next < 0 || index >= items.length || next >= items.length) return [...items];
  const copy = [...items];
  const current = copy[index];
  const target = copy[next];
  if (current === undefined || target === undefined) return [...items];
  copy[index] = target;
  copy[next] = current;
  return copy;
}
