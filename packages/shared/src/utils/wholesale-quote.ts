export interface WholesaleExtraDef {
  id: string;
  name: string;
  price: number;
}

export interface WholesalePackageDef {
  id: string;
  name: string;
  minQuantity: number;
  unitPrice: number;
  watchIds: string[];
}

export interface WholesaleExtraSelection {
  extraId: string;
  quantity: number;
}

export interface WholesaleQuoteInputLine {
  watchId: string;
  quantity: number;
  wholesalePrice: number;
  extras?: WholesaleExtraSelection[];
}

export interface WholesaleQuotedExtra {
  extraId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface WholesaleQuotedLine {
  watchId: string;
  quantity: number;
  floorUnitPrice: number;
  watchUnitPrice: number;
  extrasUnitPrice: number;
  unitPrice: number;
  lineTotal: number;
  packageId: string | null;
  packageName: string | null;
  extras: WholesaleQuotedExtra[];
}

export interface WholesaleQuoteOffer {
  id: string;
  name: string;
  minQuantity: number;
  unitPrice: number;
  qualifyingQuantity: number;
  applied: boolean;
}

export interface WholesaleQuoteResult {
  lines: WholesaleQuotedLine[];
  subtotal: number;
  offers: WholesaleQuoteOffer[];
}

const MAX_EXTRA_QTY = 99;

function mergeExtraQuantities(extras: WholesaleExtraSelection[]) {
  const totals = new Map<string, number>();
  for (const extra of extras) {
    if (extra.quantity <= 0) continue;
    totals.set(extra.extraId, (totals.get(extra.extraId) ?? 0) + extra.quantity);
  }
  return [...totals.entries()].map(([extraId, quantity]) => ({ extraId, quantity }));
}

export function quoteWholesaleCart(
  lines: WholesaleQuoteInputLine[],
  extras: WholesaleExtraDef[],
  packages: WholesalePackageDef[],
): WholesaleQuoteResult {
  const extraById = new Map(extras.map((extra) => [extra.id, extra]));

  const normalized = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Cantidad de relojes inválida');
    }
    if (!Number.isInteger(line.wholesalePrice) || line.wholesalePrice < 0) {
      throw new Error('Precio mayorista inválido');
    }
    const selected = mergeExtraQuantities(line.extras ?? []);
    const quotedExtras: WholesaleQuotedExtra[] = selected.map((extra) => {
      if (!Number.isInteger(extra.quantity) || extra.quantity < 0 || extra.quantity > MAX_EXTRA_QTY) {
        throw new Error('Cantidad de extra inválida');
      }
      const def = extraById.get(extra.extraId);
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
    return { ...line, quotedExtras };
  });

  const offers = packages
    .filter((pkg) => pkg.minQuantity >= 1 && pkg.unitPrice >= 0)
    .map((pkg) => {
      const qualifyingQuantity = normalized.reduce((sum, line) => {
        if (pkg.watchIds.length > 0 && !pkg.watchIds.includes(line.watchId)) return sum;
        return sum + line.quantity;
      }, 0);
      return {
        id: pkg.id,
        name: pkg.name,
        minQuantity: pkg.minQuantity,
        unitPrice: pkg.unitPrice,
        qualifyingQuantity,
        watchIds: pkg.watchIds,
        eligible: qualifyingQuantity >= pkg.minQuantity,
      };
    });

  const quotedLines: WholesaleQuotedLine[] = normalized.map((line) => {
    const candidates = offers.filter((offer) => {
      if (!offer.eligible) return false;
      if (offer.watchIds.length > 0 && !offer.watchIds.includes(line.watchId)) return false;
      return offer.unitPrice < line.wholesalePrice;
    });
    candidates.sort((a, b) => a.unitPrice - b.unitPrice || a.id.localeCompare(b.id));
    const best = candidates[0] ?? null;
    const watchUnitPrice = best ? best.unitPrice : line.wholesalePrice;
    const extrasUnitPrice = line.quotedExtras.reduce(
      (sum, extra) => sum + extra.unitPrice * extra.quantity,
      0,
    );
    const unitPrice = watchUnitPrice + extrasUnitPrice;
    return {
      watchId: line.watchId,
      quantity: line.quantity,
      floorUnitPrice: line.wholesalePrice,
      watchUnitPrice,
      extrasUnitPrice,
      unitPrice,
      lineTotal: unitPrice * line.quantity,
      packageId: best?.id ?? null,
      packageName: best?.name ?? null,
      extras: line.quotedExtras,
    };
  });

  const appliedIds = new Set(
    quotedLines.map((line) => line.packageId).filter((id): id is string => !!id),
  );

  return {
    lines: quotedLines,
    subtotal: quotedLines.reduce((sum, line) => sum + line.lineTotal, 0),
    offers: offers.map(({ watchIds: _watchIds, eligible: _eligible, ...offer }) => ({
      ...offer,
      applied: appliedIds.has(offer.id),
    })),
  };
}
