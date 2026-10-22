export type LineExtraSelection = { extraId: string; quantity: number };

export type MergeablePreOrderItem = {
  watchId: string;
  quantity: number;
  deliveryNote?: string | null;
  extras?: LineExtraSelection[];
};

export type PricedSnapshotExtra = {
  extraId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

const MAX_EXTRA_QTY = 99;
const MAX_NOTE = 500;

export function mergeExtraSelections(
  extras: LineExtraSelection[],
): LineExtraSelection[] {
  const totals = new Map<string, number>();
  for (const extra of extras) {
    if (!extra.extraId || extra.quantity <= 0) continue;
    totals.set(
      extra.extraId,
      (totals.get(extra.extraId) ?? 0) + extra.quantity,
    );
  }
  return [...totals.entries()].map(([extraId, quantity]) => ({
    extraId,
    quantity,
  }));
}

export function mergePreOrderItems(
  items: MergeablePreOrderItem[],
): MergeablePreOrderItem[] {
  const grouped = new Map<string, MergeablePreOrderItem>();
  for (const item of items) {
    const note = item.deliveryNote?.trim() || null;
    const extras = mergeExtraSelections(item.extras ?? []);
    const prev = grouped.get(item.watchId);
    if (!prev) {
      grouped.set(item.watchId, {
        watchId: item.watchId,
        quantity: item.quantity,
        deliveryNote: note,
        extras,
      });
      continue;
    }
    prev.quantity += item.quantity;
    prev.extras = mergeExtraSelections([...(prev.extras ?? []), ...extras]);
    const notes = [prev.deliveryNote, note].filter(
      (value): value is string => !!value,
    );
    const unique = [...new Set(notes)];
    prev.deliveryNote = unique.length
      ? unique.join(' · ').slice(0, MAX_NOTE)
      : null;
  }
  return [...grouped.values()];
}

export function parseExtrasSnapshot(raw: unknown): PricedSnapshotExtra[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const extras: PricedSnapshotExtra[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const extra = row as Partial<PricedSnapshotExtra>;
    if (
      typeof extra.extraId !== 'string' ||
      !extra.extraId ||
      seen.has(extra.extraId)
    )
      continue;
    if (typeof extra.name !== 'string' || !extra.name) continue;
    const { unitPrice, quantity } = extra;
    if (
      typeof unitPrice !== 'number' ||
      !Number.isInteger(unitPrice) ||
      unitPrice < 0
    )
      continue;
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    )
      continue;
    seen.add(extra.extraId);
    extras.push({
      extraId: extra.extraId,
      name: extra.name,
      unitPrice,
      quantity,
    });
  }
  return extras;
}

export function repricePreservedWholesaleLine(input: {
  quantity: number;
  previousUnitPrice: number;
  previousExtras: PricedSnapshotExtra[];
  requestedExtras: LineExtraSelection[];
  catalogExtras: Array<{ id: string; name: string; price: number }>;
}): { unitPrice: number; lineTotal: number; extras: PricedSnapshotExtra[] } {
  const requested = mergeExtraSelections(input.requestedExtras);
  const snapById = new Map(
    input.previousExtras.map((extra) => [extra.extraId, extra]),
  );
  const catalogById = new Map(
    input.catalogExtras.map((extra) => [extra.id, extra]),
  );
  const previousExtrasUnit = input.previousExtras.reduce(
    (sum, extra) => sum + extra.unitPrice * extra.quantity,
    0,
  );
  const watchUnitPrice = input.previousUnitPrice - previousExtrasUnit;
  if (!Number.isInteger(watchUnitPrice) || watchUnitPrice < 0) {
    throw new Error('Precio guardado del pedido inválido');
  }
  const extras = requested.map((extra) => {
    if (!Number.isInteger(extra.quantity) || extra.quantity > MAX_EXTRA_QTY) {
      throw new Error('Cantidad de extra inválida');
    }
    const snap = snapById.get(extra.extraId);
    if (snap) return { ...snap, quantity: extra.quantity };
    const def = catalogById.get(extra.extraId);
    if (!def) throw new Error('Esa opción extra no está disponible');
    if (!Number.isInteger(def.price) || def.price < 0) {
      throw new Error('Precio de extra inválido');
    }
    return {
      extraId: def.id,
      name: def.name,
      unitPrice: def.price,
      quantity: extra.quantity,
    };
  });
  const extrasUnit = extras.reduce(
    (sum, extra) => sum + extra.unitPrice * extra.quantity,
    0,
  );
  const unitPrice = watchUnitPrice + extrasUnit;
  return { unitPrice, lineTotal: unitPrice * input.quantity, extras };
}
