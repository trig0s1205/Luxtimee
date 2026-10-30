import { BadRequestException } from '@nestjs/common';
import { OrderType } from '@prisma/client';
import { sanitizePlainText } from '../common/utils/sanitize-text.util';

export function computeSpecialSaleProfit(salePrice: number, cost: number) {
  return salePrice - cost;
}

export function assertSpecialSaleInput(input: {
  salePrice: number;
  note: string;
}) {
  const note = sanitizePlainText(input.note, 500);
  if (!note) {
    throw new BadRequestException('La nota es obligatoria');
  }
  if (!Number.isInteger(input.salePrice) || input.salePrice <= 0) {
    throw new BadRequestException('El precio de venta debe ser mayor a 0');
  }
  return { note, salePrice: input.salePrice };
}

export function profitBreakdownFromLine(input: {
  orderType: string;
  unitPrice: number;
  quantity: number;
  liveCost: number | null | undefined;
  costSnapshot?: number | null;
  commissionPercent: number;
}) {
  const revenue = input.unitPrice * input.quantity;
  const unitCost =
    input.orderType === OrderType.ESPECIAL && input.costSnapshot != null
      ? input.costSnapshot
      : (input.liveCost ?? 0);
  const cost = unitCost * input.quantity;
  const grossProfit = revenue - cost;
  const commission = Math.round(
    grossProfit * (input.commissionPercent / 100),
  );
  const profit = grossProfit - commission;
  return { revenue, cost, grossProfit, commission, profit };
}
