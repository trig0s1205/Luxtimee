export function calcMarginPercent(price: number, cost?: number | null): number | null {
  if (!cost || cost <= 0 || price <= 0) return null;
  return Math.round(((price - cost) / price) * 10000) / 100;
}

export interface WatchFinancialInput {
  cost?: number | null;
  retailPrice: number;
  wholesalePrice: number;
}

export interface WatchFinancialComputed {
  retailMarginPercentage: number | null;
  wholesaleMarginPercentage: number | null;
  profitPercent: number | null;
}

export function computeWatchFinancials(input: WatchFinancialInput): WatchFinancialComputed {
  const retailMarginPercentage = calcMarginPercent(input.retailPrice, input.cost);
  const wholesaleMarginPercentage = calcMarginPercent(input.wholesalePrice, input.cost);

  return {
    retailMarginPercentage,
    wholesaleMarginPercentage,
    profitPercent: retailMarginPercentage,
  };
}
