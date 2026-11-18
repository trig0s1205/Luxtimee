import { OrderSource } from '@prisma/client';
import type {
  ProfitBreakdownItem,
  ProfitByChannelDto,
  ProfitChannel,
  ProfitChannelTotalsDto,
  ShippingBreakdownItem,
} from '@luxtime/shared';

export type { ProfitChannel };

export function channelForSource(
  source: OrderSource | string | null | undefined,
): ProfitChannel {
  return source === OrderSource.LOCAL ? 'LOCAL' : 'WEB';
}

export function commissionPercentForSource(
  source: OrderSource | string | null | undefined,
  percent: number,
): number {
  return source === OrderSource.LOCAL ? 0 : percent;
}

function emptyTotals(): ProfitChannelTotalsDto {
  return {
    revenue: 0,
    cost: 0,
    grossProfit: 0,
    commission: 0,
    profit: 0,
    shippingRevenue: 0,
  };
}

function addLine(
  bucket: ProfitChannelTotalsDto,
  item: Pick<
    ProfitBreakdownItem,
    'revenue' | 'cost' | 'commission' | 'profit'
  >,
) {
  bucket.revenue += item.revenue;
  bucket.cost += item.cost;
  bucket.commission += item.commission;
  bucket.profit += item.profit;
}

export function summarizeProfitByChannel(
  items: Array<
    Pick<
      ProfitBreakdownItem,
      'channel' | 'revenue' | 'cost' | 'commission' | 'profit'
    >
  >,
  shippingItems: Array<
    Pick<ShippingBreakdownItem, 'channel' | 'shippingCost'>
  >,
): ProfitByChannelDto {
  const web = emptyTotals();
  const local = emptyTotals();

  for (const item of items) {
    addLine(item.channel === 'LOCAL' ? local : web, item);
  }

  for (const ship of shippingItems) {
    const bucket = ship.channel === 'LOCAL' ? local : web;
    bucket.shippingRevenue += ship.shippingCost;
  }

  web.grossProfit = web.revenue - web.cost;
  local.grossProfit = local.revenue - local.cost;

  const total: ProfitChannelTotalsDto = {
    revenue: web.revenue + local.revenue,
    cost: web.cost + local.cost,
    grossProfit: web.grossProfit + local.grossProfit,
    commission: web.commission + local.commission,
    profit: web.profit + local.profit,
    shippingRevenue: web.shippingRevenue + local.shippingRevenue,
  };

  return { web, local, total };
}
