export type BulkSimilarityDecision = 'pending' | 'keep';

/**
 * Subir todo encola todos los pares visibles.
 * similarityDecisions se conserva en la firma para fijar que un aviso
 * de parecido (pending o keep) no puede bloquear la subida.
 */
export function bulkUploadAction(state: {
  confirming: boolean;
  pairCount: number;
  similarityDecisions?: BulkSimilarityDecision[];
}): 'upload' | 'noop' {
  if (state.confirming || state.pairCount < 1) return 'noop';
  return 'upload';
}
