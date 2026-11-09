import { OrderSource } from '@prisma/client';
import {
  channelForSource,
  commissionPercentForSource,
  summarizeProfitByChannel,
} from './profit-channel.util';

describe('profit-channel.util', () => {
  it('channelForSource marca LOCAL solo para origen local', () => {
    expect(channelForSource(OrderSource.LOCAL)).toBe('LOCAL');
    expect(channelForSource(OrderSource.WEB)).toBe('WEB');
    expect(channelForSource(OrderSource.WHATSAPP)).toBe('WEB');
    expect(channelForSource(OrderSource.MAYORISTA)).toBe('WEB');
    expect(channelForSource(null)).toBe('WEB');
  });

  it('commissionPercentForSource es 0 en LOCAL', () => {
    expect(commissionPercentForSource(OrderSource.LOCAL, 10)).toBe(0);
    expect(commissionPercentForSource(OrderSource.WEB, 10)).toBe(10);
    expect(commissionPercentForSource(OrderSource.WHATSAPP, 12)).toBe(12);
  });

  it('summarizeProfitByChannel agrupa web, local y total', () => {
    const summary = summarizeProfitByChannel(
      [
        {
          channel: 'WEB',
          revenue: 100_000,
          cost: 40_000,
          commission: 6_000,
          profit: 54_000,
        },
        {
          channel: 'LOCAL',
          revenue: 50_000,
          cost: 20_000,
          commission: 0,
          profit: 30_000,
        },
      ],
      [
        { channel: 'WEB', shippingCost: 8_000 },
        { channel: 'LOCAL', shippingCost: 5_000 },
      ],
    );

    expect(summary.web).toEqual({
      revenue: 100_000,
      cost: 40_000,
      grossProfit: 60_000,
      commission: 6_000,
      profit: 54_000,
      shippingRevenue: 8_000,
    });
    expect(summary.local).toEqual({
      revenue: 50_000,
      cost: 20_000,
      grossProfit: 30_000,
      commission: 0,
      profit: 30_000,
      shippingRevenue: 5_000,
    });
    expect(summary.total).toEqual({
      revenue: 150_000,
      cost: 60_000,
      grossProfit: 90_000,
      commission: 6_000,
      profit: 84_000,
      shippingRevenue: 13_000,
    });
  });
});
