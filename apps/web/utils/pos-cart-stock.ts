export type StockLine = { stock: number; quantity: number };

export function lineStockBlocked(line: StockLine): boolean {
  return line.stock <= 0 || line.quantity > line.stock;
}

export function cartHasBlockedStock(lines: StockLine[]): boolean {
  return lines.some(lineStockBlocked);
}
