import { BadRequestException } from '@nestjs/common';

const MM_TO_PT = 72 / 25.4;

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

export type LabelLayout = 'SHEET_LETTER_3X10' | 'THERMAL_50X25';

export type LabelItemInput = { watchId: string; quantity: number };

export type ExpandedLabel = { watchId: string };

export type SheetSlot = { page: number; x: number; y: number };

/** Avery 5160 compatible sheet geometry (points). */
export const SHEET = {
  pageWidth: 612,
  pageHeight: 792,
  cols: 3,
  rows: 10,
  labelW: mmToPt(66.7),
  labelH: mmToPt(25.4),
  marginTop: mmToPt(12.7),
  marginLeft: mmToPt(4.76),
  stepX: mmToPt(69.85),
  stepY: mmToPt(25.4),
  perPage: 30,
} as const;

export const THERMAL = {
  pageWidth: mmToPt(50),
  pageHeight: mmToPt(25),
} as const;

export function expandLabelItems(
  items: LabelItemInput[],
  maxTotal = 1000,
): ExpandedLabel[] {
  const expanded: ExpandedLabel[] = [];
  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity));
    if (qty === 0) continue;
    for (let i = 0; i < qty; i++) {
      expanded.push({ watchId: item.watchId });
    }
  }
  if (expanded.length === 0) {
    throw new BadRequestException('Indica al menos una etiqueta');
  }
  if (expanded.length > maxTotal) {
    throw new BadRequestException('Máximo 1000 etiquetas por PDF');
  }
  return expanded;
}

export function sheetSlots(
  count: number,
  startPosition = 1,
  offsetXmm = 0,
  offsetYmm = 0,
): SheetSlot[] {
  const start = Math.min(30, Math.max(1, Math.floor(startPosition)));
  const offsetX = mmToPt(offsetXmm);
  const offsetY = mmToPt(offsetYmm);
  const slots: SheetSlot[] = [];
  for (let i = 0; i < count; i++) {
    const absolute = start - 1 + i;
    const page = Math.floor(absolute / SHEET.perPage);
    const posOnPage = absolute % SHEET.perPage;
    const col = posOnPage % SHEET.cols;
    const row = Math.floor(posOnPage / SHEET.cols);
    slots.push({
      page,
      x: SHEET.marginLeft + col * SHEET.stepX + offsetX,
      y: SHEET.marginTop + row * SHEET.stepY + offsetY,
    });
  }
  return slots;
}

export function thermalSlots(
  count: number,
  offsetXmm = 0,
  offsetYmm = 0,
): SheetSlot[] {
  const offsetX = mmToPt(offsetXmm);
  const offsetY = mmToPt(offsetYmm);
  return Array.from({ length: count }, (_, page) => ({
    page,
    x: offsetX,
    y: offsetY,
  }));
}
