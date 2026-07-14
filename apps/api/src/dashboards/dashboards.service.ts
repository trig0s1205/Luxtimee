import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { Ga4Service } from '../integrations/ga4.service';
import type { HealthDashboardDto, ProfitDashboardDto } from '@luxtime/shared';

@Injectable()
export class DashboardsService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private ga4Service: Ga4Service,
  ) {}

  async getProfitDashboard(period: 'day' | 'week' | 'month' | 'all' = 'month'): Promise<ProfitDashboardDto> {
    const since = this.periodStart(period);
    const commission = (await this.settingsService.getCommissionConfig()).percent;

    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO] },
        paidAt: since ? { gte: since } : undefined,
      },
      include: { items: { include: { watch: true } } },
    });

    const items = orders.flatMap((order) =>
      order.items.map((item) => {
        const revenue = item.unitPrice * item.quantity;
        const cost = (item.watch.cost ?? 0) * item.quantity;
        const profit = revenue - cost;
        const profitPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
        const commissionAmount = Math.round(revenue * (commission / 100));
        return {
          orderId: order.id,
          readableId: order.readableId,
          productName: item.productName,
          quantity: item.quantity,
          revenue,
          cost,
          profit,
          profitPercent,
          commission: commissionAmount,
          paidAt: order.paidAt?.toISOString() ?? order.createdAt.toISOString(),
        };
      }),
    );

    return {
      period,
      totalRevenue: items.reduce((s, i) => s + i.revenue, 0),
      totalCost: items.reduce((s, i) => s + i.cost, 0),
      totalProfit: items.reduce((s, i) => s + i.profit, 0),
      totalCommission: items.reduce((s, i) => s + i.commission, 0),
      items,
    };
  }

  async getHealthDashboard(): Promise<HealthDashboardDto & { business: Record<string, number> }> {
    const ga = await this.ga4Service.getEngagementMetrics();
    const [preOrders, paidOrders, activeWatches, lowStock] = await Promise.all([
      this.prisma.order.count({ where: { stage: 'PRE_ORDER', canceledAt: null } }),
      this.prisma.order.count({
        where: { status: { in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO] } },
      }),
      this.prisma.watch.count({ where: { isActive: true } }),
      this.prisma.watch.count({ where: { isActive: true, stock: { lte: 1 } } }),
    ]);

    return {
      ...ga,
      business: { preOrders, paidOrders, activeWatches, lowStock },
    };
  }

  private periodStart(period: string) {
    const now = new Date();
    if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') return new Date(now.getTime() - 7 * 86400000);
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    return null;
  }
}
