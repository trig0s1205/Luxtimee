import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { HealthDashboardDto, ProfitDashboardDto, RevenueDashboardDto, RevenueOrderPointDto, RevenueRange } from '@luxtime/shared';

@Injectable()
export class DashboardsService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
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
        const retailMarginPercentage = item.watch.retailMarginPercentage
          ? Number(item.watch.retailMarginPercentage)
          : profitPercent;
        const wholesaleMarginPercentage = item.watch.wholesaleMarginPercentage
          ? Number(item.watch.wholesaleMarginPercentage)
          : 0;
        const commissionPercent = commission;
        const commissionAmount = Math.round(revenue * (commissionPercent / 100));
        return {
          orderId: order.id,
          readableId: order.readableId,
          productName: item.productName,
          quantity: item.quantity,
          revenue,
          cost,
          profit,
          profitPercent,
          retailMarginPercentage,
          wholesaleMarginPercentage,
          commissionPercent,
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

  async getHealthDashboard(period: 'day' | '2weeks' | 'week' | 'month' | '3months' | 'all' = 'month'): Promise<HealthDashboardDto> {
    const since = this.periodStart(period);
    const previousRange = this.previousPeriodRange(period);
    const periodLabel = this.healthPeriodLabel(period);
    const LOW_STOCK_THRESHOLD = 2;

    const paidOrdersWhere = {
      status: { in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO] },
      ...(since ? { paidAt: { gte: since } } : {}),
    };

    const previousPaidOrdersWhere = previousRange
      ? {
          status: { in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO] },
          paidAt: { gte: previousRange.since, lt: previousRange.until },
        }
      : null;

    const [
      preOrders,
      paidOrders,
      activeWatches,
      lowStockWatches,
      unattendedOrders,
      paidOrdersInPeriod,
      ordersToShip,
      previousPaidOrders,
      previousPaidOrdersInPeriod,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          stage: 'PRE_ORDER',
          canceledAt: null,
          ...(since ? { createdAt: { gte: since } } : {}),
        },
      }),
      this.prisma.order.count({ where: paidOrdersWhere }),
      this.prisma.watch.count({ where: { isActive: true } }),
      this.prisma.watch.findMany({
        where: { isActive: true, deletedAt: null, stock: { lte: LOW_STOCK_THRESHOLD } },
        include: { brand: true },
        orderBy: { stock: 'asc' },
        take: 6,
      }),
      this.prisma.order.findMany({
        where: { stage: 'PRE_ORDER', canceledAt: null, depositConfirmed: false },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
        take: 5,
      }),
      this.prisma.order.findMany({
        where: paidOrdersWhere,
        include: { items: true },
      }),
      this.prisma.order.count({ where: { status: OrderStatus.PAGADO } }),
      previousPaidOrdersWhere
        ? this.prisma.order.count({ where: previousPaidOrdersWhere })
        : Promise.resolve(0),
      previousPaidOrdersWhere
        ? this.prisma.order.findMany({
            where: previousPaidOrdersWhere,
            select: { total: true },
          })
        : Promise.resolve([]),
    ]);

    const topSoldMap = new Map<string, number>();
    for (const order of paidOrdersInPeriod) {
      for (const item of order.items) {
        topSoldMap.set(item.watchId, (topSoldMap.get(item.watchId) ?? 0) + item.quantity);
      }
    }
    const topSold = [...topSoldMap.entries()]
      .map(([watchId, quantity]) => ({ watchId, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const topWatchIds = topSold.map((row) => row.watchId);
    const topWatchRecords = topWatchIds.length
      ? await this.prisma.watch.findMany({
          where: { id: { in: topWatchIds } },
          include: { brand: true },
        })
      : [];
    const topWatchMap = new Map(topWatchRecords.map((watch) => [watch.id, watch]));
    const now = Date.now();
    const periodRevenue = paidOrdersInPeriod.reduce((sum, order) => sum + order.total, 0);
    const unitsSold = paidOrdersInPeriod.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const previousPeriodRevenue = previousPaidOrdersInPeriod.reduce((sum, order) => sum + order.total, 0);
    const chartTo = new Date();
    const paidChartOrders = paidOrdersInPeriod
      .filter((order) => order.paidAt)
      .sort((a, b) => a.paidAt!.getTime() - b.paidAt!.getTime());
    const chartFrom = since
      ?? (paidChartOrders.length
        ? new Date(paidChartOrders[0].paidAt!.getTime())
        : new Date(chartTo.getTime() - 7 * 86400000));

    return {
      period,
      metrics: [],
      periodLabel,
      business: {
        preOrders,
        paidOrders,
        activeWatches,
        lowStockCount: lowStockWatches.length,
        ordersToShip,
        periodRevenue,
        unitsSold,
        previousPaidOrders,
        previousPeriodRevenue,
      },
      chartBounds: {
        from: chartFrom.toISOString(),
        to: chartTo.toISOString(),
      },
      chartOrders: paidChartOrders.map((order) => ({
        id: order.id,
        readableId: order.readableId,
        customerName: order.customerName,
        total: order.total,
        status: order.status ?? 'PAGADO',
        productSummary: order.items.map((item) => item.productName).join(', '),
        paidAt: order.paidAt!.toISOString(),
      })),
      unattendedPreOrders: unattendedOrders.map((order) => ({
        id: order.id,
        readableId: order.readableId,
        customerName: order.customerName,
        model: order.items[0]?.productName ?? 'Pedido',
        waitHours: Math.max(0, Math.round((now - order.createdAt.getTime()) / 3600000)),
      })),
      lowStockWatches: lowStockWatches.map((watch) => ({
        id: watch.id,
        model: watch.model,
        brand: watch.brand.name,
        stock: watch.stock,
        image: watch.frontImageUrl ?? watch.primaryImageUrl ?? watch.images[0] ?? null,
      })),
      topWatches: topSold.map((row) => {
        const watch = topWatchMap.get(row.watchId);
        return {
          id: row.watchId,
          model: watch?.model ?? 'Reloj eliminado',
          brand: watch?.brand.name ?? '—',
          reference: watch?.reference ?? null,
          image: watch?.frontImageUrl ?? watch?.primaryImageUrl ?? watch?.images[0] ?? null,
          unitsSold: row.quantity,
          stock: watch?.stock ?? 0,
        };
      }),
    };
  }

  async getRevenueDashboard(range: RevenueRange = '1_month'): Promise<RevenueDashboardDto> {
    const since = this.revenueRangeStart(range);
    const confirmed = [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO];

    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: confirmed },
        paidAt: {
          not: null,
          ...(since ? { gte: since } : {}),
        },
      },
      include: { items: { select: { productName: true } } },
      orderBy: { paidAt: 'asc' },
    });

    const points: RevenueOrderPointDto[] = orders
      .filter((order) => order.paidAt)
      .map((order) => ({
        id: order.id,
        readableId: order.readableId,
        customerName: order.customerName,
        productSummary: order.items.map((item) => item.productName).join(', '),
        paidAt: order.paidAt!.toISOString(),
        total: order.total,
      }));

    return {
      range,
      orders: points,
      total: points.reduce((sum, point) => sum + point.total, 0),
    };
  }

  private revenueRangeStart(range: RevenueRange): Date | null {
    const now = new Date();
    if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === '1_week') return new Date(now.getTime() - 7 * 86400000);
    if (range === '1_month') return new Date(now.getFullYear(), now.getMonth(), 1);
    return null;
  }

  private healthPeriodLabel(period: string) {
    if (period === 'day') return 'Hoy';
    if (period === '2weeks') return '2 semanas';
    if (period === 'week') return 'Última semana';
    if (period === 'month') return 'Este mes';
    if (period === '3months') return '3 meses';
    return 'Histórico';
  }

  private periodStart(period: string) {
    const now = new Date();
    if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === '2weeks') return new Date(now.getTime() - 14 * 86400000);
    if (period === 'week') return new Date(now.getTime() - 7 * 86400000);
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === '3months') return new Date(now.getTime() - 90 * 86400000);
    return null;
  }

  private previousPeriodRange(period: string) {
    const now = new Date();
    if (period === 'day') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { since: new Date(today.getTime() - 86400000), until: today };
    }
    if (period === '2weeks') {
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
      return { since: new Date(now.getTime() - 28 * 86400000), until: twoWeeksAgo };
    }
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      return { since: new Date(now.getTime() - 14 * 86400000), until: weekAgo };
    }
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since: new Date(now.getFullYear(), now.getMonth() - 1, 1), until: monthStart };
    }
    if (period === '3months') {
      const threeMonthsAgo = new Date(now.getTime() - 90 * 86400000);
      return { since: new Date(now.getTime() - 180 * 86400000), until: threeMonthsAgo };
    }
    return null;
  }
}
