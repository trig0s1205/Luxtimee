import { bogotaDateParts, bogotaDateTimeUtc } from '../receipts/bogota-time.util';
import {
  allocateAmounts,
  cashEventsForOrder,
  recognizeCollected,
} from '../orders/order-payments.util';
import { channelForSource } from './profit-channel.util';

export type ProfitPeriod = 'day' | 'week' | 'month' | 'all';
export type ProfitChannelFilter = 'LOCAL' | 'WEB' | 'ALL';

export type ProfitCostStatus = 'SNAPSHOT' | 'ESTIMATED' | 'MISSING';

export function profitPeriodRange(
  period: ProfitPeriod,
  now = new Date(),
): { since: Date | null; until: Date | null } {
  if (period === 'all') return { since: null, until: null };
  const parts = bogotaDateParts(now);
  const startToday = bogotaDateTimeUtc(parts, 0, 0, 0, 0);
  if (period === 'day') return { since: startToday, until: null };
  if (period === 'week') {
    return {
      since: new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000),
      until: null,
    };
  }
  return {
    since: bogotaDateTimeUtc({ ...parts, day: 1 }, 0, 0, 0, 0),
    until: null,
  };
}

export function payrollFund(input: {
  invoiced: number;
  percent: number;
  payroll: number;
  channelInvoiced: number;
}) {
  const percent = Number.isFinite(input.percent) ? input.percent : 0;
  const invoiced = Math.max(0, Math.round(input.invoiced));
  const channelInvoiced = Math.max(0, Math.round(input.channelInvoiced));
  const payroll = Math.max(0, Math.round(input.payroll));
  const fund = Math.round(invoiced * (percent / 100));
  const channelFund = Math.round(channelInvoiced * (percent / 100));
  const neededPercent = invoiced > 0 ? (payroll / invoiced) * 100 : null;
  const salesToCover = percent > 0 ? Math.ceil(payroll / (percent / 100)) : null;
  return {
    fundPercent: percent,
    invoiced,
    fund,
    payroll,
    surplus: fund - payroll,
    neededPercent,
    salesToCover,
    channelInvoiced,
    channelFund,
  };
}

type RawItem = {
  unitPrice: number;
  quantity: number;
  discountAmount?: number | null;
  unitCostSnapshot?: number | null;
  productName?: string | null;
  productSku?: string | null;
  productImage?: string | null;
  watchId?: string | null;
  watch?: {
    cost?: number | null;
    sku?: string | null;
    brand?: { name?: string | null } | null;
  } | null;
};

export type ProfitOrderInput = {
  id: string;
  readableId: string;
  type: string;
  status?: string | null;
  source?: string | null;
  subtotal?: number | null;
  discountAmount?: number | null;
  total?: number | null;
  shippingCost?: number | null;
  depositExpected?: number | null;
  depositConfirmed?: boolean | null;
  specialCostSnapshot?: number | null;
  paidAt?: Date | null;
  deliveredAt?: Date | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
  customerName?: string | null;
  seller?: { name?: string | null } | null;
  shippingZone?: { name?: string | null } | null;
  payments?: Array<{ amount: number; paidAt: Date | string; method?: string | null }> | null;
  items: RawItem[];
};

export type BuiltProfitLine = {
  orderId: string;
  readableId: string;
  orderType: string;
  orderStatus: string;
  productName: string;
  productSku: string;
  productImage: string | null;
  watchId: string | null;
  brand: string | null;
  quantity: number;
  gross: number;
  discount: number;
  revenue: number;
  cost: number;
  profit: number;
  costStatus: ProfitCostStatus;
  channel: 'LOCAL' | 'WEB';
  paidAt: string;
  customerName: string;
  sellerName: string | null;
};

function positiveCost(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function linesFromOrder(
  order: ProfitOrderInput,
  since?: Date | null,
  until?: Date | null,
): { lines: BuiltProfitLine[]; shipping: number; paidAt: string | null } {
  const lineGrosses = order.items.map(
    (item) => Math.max(0, item.unitPrice) * Math.max(0, item.quantity),
  );
  const lineDiscounts = order.items.map((item) =>
    Math.max(0, item.discountAmount ?? 0),
  );
  const grossSum = lineGrosses.reduce((sum, value) => sum + value, 0);
  const discountSum = lineDiscounts.reduce((sum, value) => sum + value, 0);
  const subtotal = order.subtotal || grossSum;
  const shippingCost = order.shippingCost ?? 0;
  const statedDiscount = Math.max(0, order.discountAmount ?? 0);
  const impliedDiscount = Math.max(
    0,
    subtotal - Math.max(0, (order.total ?? subtotal + shippingCost) - shippingCost),
  );
  const orderDiscount = Math.max(statedDiscount, impliedDiscount);
  const extraDiscount = Math.max(0, orderDiscount - discountSum);
  const extraAlloc = allocateAmounts(lineGrosses, extraDiscount);
  const lineNets = lineGrosses.map((gross, index) =>
    Math.max(0, gross - lineDiscounts[index] - (extraAlloc[index] ?? 0)),
  );
  const netProduct = lineNets.reduce((sum, value) => sum + value, 0);

  const recognized = recognizeCollected({
    subtotal: netProduct,
    shippingCost,
    events: cashEventsForOrder({
      ...order,
      total: order.total || netProduct + shippingCost,
    }),
    since,
    until,
  });
  if (recognized.product <= 0 || !recognized.paidAt) {
    return { lines: [], shipping: recognized.shipping, paidAt: null };
  }

  const allocations = allocateAmounts(lineNets, recognized.product);
  const channel = channelForSource(order.source);
  const paidAt = recognized.paidAt.toISOString();
  const lines: BuiltProfitLine[] = [];

  order.items.forEach((item, index) => {
    const revenue = allocations[index] ?? 0;
    const lineNet = lineNets[index] ?? 0;
    if (revenue <= 0 || lineNet <= 0) return;
    const ratio = revenue / lineNet;
    const discount = Math.round(
      (lineDiscounts[index] + (extraAlloc[index] ?? 0)) * ratio,
    );
    const gross = revenue + discount;
    const snapshot = positiveCost(item.unitCostSnapshot);
    const special = positiveCost(order.specialCostSnapshot);
    const live = positiveCost(item.watch?.cost);
    let unit: number | null = null;
    let costStatus: ProfitCostStatus = 'MISSING';
    if (snapshot != null) {
      unit = snapshot;
      costStatus = 'SNAPSHOT';
    } else if (order.type === 'ESPECIAL' && special != null) {
      unit = special;
      costStatus = 'SNAPSHOT';
    } else if (live != null) {
      unit = live;
      costStatus = 'ESTIMATED';
    }
    const fullCost = unit == null ? 0 : unit * Math.max(0, item.quantity);
    const cost = unit == null ? 0 : Math.round(fullCost * ratio);
    const profit = unit == null ? 0 : revenue - cost;
    lines.push({
      orderId: order.id,
      readableId: order.readableId,
      orderType: order.type,
      orderStatus: order.status ?? 'PENDIENTE',
      productName: item.productName ?? 'Reloj',
      productSku: item.productSku || item.watch?.sku || '',
      productImage: item.productImage ?? null,
      watchId: item.watchId ?? null,
      brand: item.watch?.brand?.name ?? null,
      quantity: item.quantity,
      gross,
      discount,
      revenue,
      cost,
      profit,
      costStatus,
      channel,
      paidAt,
      customerName: order.customerName ?? '',
      sellerName: order.seller?.name ?? null,
    });
  });

  return { lines, shipping: recognized.shipping, paidAt };
}
