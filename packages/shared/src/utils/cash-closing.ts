/** Esperado en caja = apertura + ventas en efectivo − salidas en efectivo. */
export function expectedDrawerCash(
  openingCash: number,
  cashSales: number,
  cashOuts: number,
): number {
  return openingCash + cashSales - cashOuts;
}

export function cashClosingNoteRequired(difference: number): boolean {
  return difference !== 0;
}

export function cashClosingNoteValid(
  difference: number,
  notes: string | null | undefined,
): boolean {
  if (!cashClosingNoteRequired(difference)) return true;
  return (notes?.trim().length ?? 0) >= 5;
}
