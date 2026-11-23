export type DuplicateRemovalTarget = {
  pairId: string;
  side: 'front' | 'back';
};

export type PairShape = {
  id: string;
  hasBack: boolean;
};

export function planDuplicatePairRemoval(
  items: DuplicateRemovalTarget[],
  pairs: PairShape[],
): { removePairIds: string[]; partialPairIds: string[] } {
  const byPair = new Map<string, Set<'front' | 'back'>>();
  for (const item of items) {
    const sides = byPair.get(item.pairId) ?? new Set<'front' | 'back'>();
    sides.add(item.side);
    byPair.set(item.pairId, sides);
  }
  const known = new Map(pairs.map((pair) => [pair.id, pair]));
  const removePairIds: string[] = [];
  const partialPairIds: string[] = [];
  for (const [pairId, sides] of byPair) {
    const pair = known.get(pairId);
    if (!pair) continue;
    removePairIds.push(pairId);
    const both = sides.has('front') && sides.has('back');
    if (pair.hasBack && !both) partialPairIds.push(pairId);
  }
  return { removePairIds, partialPairIds };
}

export function duplicateRemovalNote(partialCount: number): string {
  if (partialCount <= 0) return '';
  if (partialCount === 1) {
    return 'Se quitó el par completo: una de las fotos estaba repetida.';
  }
  return `Se quitaron ${partialCount} pares completos porque una de sus fotos estaba repetida.`;
}
