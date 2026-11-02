export interface CashEvent {
  amount: number;
  paidAt: Date;
}

const SETTLED_STATUSES = new Set(['PAGADO', 'ENVIADO', 'ENTREGADO']);

function asDate(value: Date | string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function money(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value as number));
}

export function isOrderSettled(order: {
  status?: string | null;
  type?: string | null;
  paidAt?: Date | string | null;
}): boolean {
  if (order.type === 'ESPECIAL') return true;
  if (order.paidAt) return true;
  return SETTLED_STATUSES.has(order.status ?? '');
}

export function cashEventsForOrder(order: {
  total: number;
  depositExpected?: number | null;
  depositConfirmed?: boolean | null;
  status?: string | null;
  type?: string | null;
  paidAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
  payments?: Array<{ amount: number; paidAt: Date | string }> | null;
}): CashEvent[] {
  const rows = order.payments ?? [];
  if (rows.length > 0) {
    return rows
      .filter((row) => money(row.amount) > 0)
      .map((row) => ({
        amount: money(row.amount),
        paidAt: asDate(row.paidAt, new Date(0)),
      }));
  }

  const total = money(order.total);
  if (isOrderSettled(order) && total > 0) {
    const at = asDate(
      order.paidAt ?? order.deliveredAt ?? order.updatedAt ?? order.createdAt,
      new Date(0),
    );
    return [{ amount: total, paidAt: at }];
  }

  if (order.depositConfirmed) {
    const amount = Math.min(money(order.depositExpected), total);
    if (amount > 0) {
      return [
        {
          amount,
          paidAt: asDate(order.updatedAt ?? order.createdAt, new Date(0)),
        },
      ];
    }
  }

  return [];
}

export function splitCollected(
  collected: number,
  subtotal: number,
  shippingCost: number,
) {
  const productCap = money(subtotal);
  const shippingCap = money(shippingCost);
  const cash = money(collected);
  const product = Math.min(cash, productCap);
  const shipping = Math.min(Math.max(cash - productCap, 0), shippingCap);
  return { product, shipping };
}

export function recognizeCollected(input: {
  subtotal: number;
  shippingCost: number;
  events: CashEvent[];
  since?: Date | null;
  until?: Date | null;
}) {
  const since = input.since ?? null;
  const until = input.until ?? null;
  let prior = 0;
  let period = 0;
  let paidAt: Date | null = null;

  for (const event of input.events) {
    if (until && event.paidAt >= until) continue;
    if (since && event.paidAt < since) {
      prior += event.amount;
      continue;
    }
    period += event.amount;
    if (!paidAt || event.paidAt > paidAt) paidAt = event.paidAt;
  }

  const before = splitCollected(prior, input.subtotal, input.shippingCost);
  const after = splitCollected(
    prior + period,
    input.subtotal,
    input.shippingCost,
  );

  return {
    product: after.product - before.product,
    shipping: after.shipping - before.shipping,
    collected: period,
    paidAt,
  };
}

export function allocateAmounts(weights: number[], total: number): number[] {
  const safeWeights = weights.map((weight) => money(weight));
  const target = money(total);
  const sum = safeWeights.reduce((acc, weight) => acc + weight, 0);
  if (target <= 0 || sum <= 0) return safeWeights.map(() => 0);
  if (target >= sum) return safeWeights;

  let remaining = target;
  return safeWeights.map((weight, index) => {
    if (index === safeWeights.length - 1) return remaining;
    const share = Math.min(
      remaining,
      Math.round((target * weight) / sum),
    );
    remaining -= share;
    return share;
  });
}

export function summarizeOrderPayments(order: {
  total: number;
  items: Array<{ quantity: number }>;
  payments?: Array<{
    id: string;
    type: string;
    amount: number;
    paidAt: Date;
    registeredById: string | null;
    registeredBy?: { name: string } | null;
  }> | null;
}) {
  const payments = (order.payments ?? []).map((payment) => ({
    id: payment.id,
    type: payment.type === 'SALDO' ? 'SALDO' as const : 'ABONO' as const,
    amount: payment.amount,
    paidAt: payment.paidAt.toISOString(),
    registeredById: payment.registeredById,
    registeredByName: payment.registeredBy?.name ?? null,
  }));
  const depositPaid = payments
    .filter((payment) => payment.type === 'ABONO')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    payments,
    depositPaid,
    paidTotal,
    balanceDue: Math.max(0, order.total - paidTotal),
    unitCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
