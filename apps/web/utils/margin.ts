export function calcMarginPercent(price: number, cost?: number | null): number | null {
  if (!cost || cost <= 0 || price <= 0) return null;
  return Math.round(((price - cost) / price) * 10000) / 100;
}
