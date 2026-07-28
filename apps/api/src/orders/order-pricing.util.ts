import { OrderType, PriceType } from '@prisma/client';

const WHOLESALE_MIN_UNITS = 4;
const DEPOSIT_PER_UNIT_COP = 10_000;

export interface PricedLineInput {
  watchId: string;
  quantity: number;
  retailPrice: number;
  wholesalePrice: number;
  productName: string;
  productRef: string;
  productImage?: string | null;
  whatsappLabel?: string;
}

export interface PricedLine extends PricedLineInput {
  unitPrice: number;
  priceType: PriceType;
  lineTotal: number;
}

export function resolveOrderType(unitCount: number): OrderType {
  return unitCount >= WHOLESALE_MIN_UNITS ? OrderType.MAYORISTA : OrderType.DETAL;
}

export function priceOrderLines(
  items: PricedLineInput[],
  shippingCost = 0,
): {
  type: OrderType;
  unitCount: number;
  subtotal: number;
  shippingCost: number;
  total: number;
  depositExpected: number;
  lines: PricedLine[];
} {
  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const type = resolveOrderType(unitCount);
  const lines: PricedLine[] = items.map((item) => {
    const unitPrice = type === OrderType.MAYORISTA ? item.wholesalePrice : item.retailPrice;
    const priceType = type === OrderType.MAYORISTA ? PriceType.WHOLESALE : PriceType.RETAIL;
    return {
      ...item,
      unitPrice,
      priceType,
      lineTotal: unitPrice * item.quantity,
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const depositExpected = DEPOSIT_PER_UNIT_COP * unitCount;
  const total = subtotal + shippingCost;
  return { type, unitCount, subtotal, shippingCost, total, depositExpected, lines };
}

export function generateReadableId(sequence: number): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  return `LX-${y}${m}${d}-${seq}`;
}
