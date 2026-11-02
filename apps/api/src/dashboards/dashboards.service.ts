import { Injectable } from '@nestjs/common';
import { OrderStage, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { profitBreakdownFromLine } from '../orders/special-sale.util';
import {
  allocateAmounts,
  cashEventsForOrder,
  recognizeCollected,
} from '../orders/order-payments.util';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { PreOrdersService } from '../pre-orders/pre-orders.service';
import type {
  HealthDashboardDto,
  ProfitDashboardDto,
  RevenueDashboardDto,
  RevenueOrderPointDto,
  RevenueRange,
} from '@luxtime/shared';
import {
  GLOBAL_INVENTORY_LOW_THRESHOLD,
  PRE_ORDER_ALERT_HOURS,
} from '@luxtime/shared';

@Injectable()
export class DashboardsService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private preOrdersService: PreOrdersService,
  ) {}

  async getProfitDashboard(
    period: 'day' | 'week' | 'month' | 'all' = 'month',
  ): Promise<ProfitDashboardDto> {
    const since = this.periodStart(period);
    const [commissionConfig, profitConfig] = await Promise.all([
      this.settingsService.getCommissionConfig(),
      this.settingsService.getProfitConfig(),
    ]);
    const commissionPercent = commissionConfig.percent;
    const reinvestmentPercent = profitConfig.reinvestmentPercent ?? 35;
    const ownerProfitPercent =
      profitConfig.ownerProfitPercent ?? Math.max(0, 100 - reinvestmentPercent);
    const activeStatuses = [
      OrderStatus.PENDIENTE,
      OrderStatus.PAGADO,
      OrderStatus.ENVIADO,
      OrderStatus.ENTREGADO,
    ];

    const [orders, inventoryWatches] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          stage: OrderStage.ORDER,
          canceledAt: null,
          status: { in: activeStatuses },
          ...(since
            ? {
                OR: [
                  { payments: { some: { paidAt: { gte: since } } } },
                  { paidAt: { gte: since } },
                  { createdAt: { gte: since } },
                  { updatedAt: { gte: since } },
                ],
              }
            : {}),
        },
        include: {
          items: { include: { watch: true } },
          shippingZone: { select: { name: true } },
          payments: { select: { amount: true, paidAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.watch.findMany({
        where: { deletedAt: null },
        select: { cost: true, stock: true },
      }),
    ]);

    const totalInventoryInvestment = inventoryWatches.reduce(
      (sum, watch) => sum + (watch.cost ?? 0) * watch.stock,
      0,
    );

    const items = orders.flatMap((order) => {
      const lineTotals = order.items.map(
        (item) => item.unitPrice * item.quantity,
      );
      const lineSum = lineTotals.reduce((sum, value) => sum + value, 0);
      const subtotal = order.subtotal || lineSum;
      const recognized = recognizeCollected({
        subtotal,
        shippingCost: order.shippingCost,
        events: cashEventsForOrder({
          ...order,
          total: order.total || subtotal + order.shippingCost,
        }),
        since,
      });
      if (recognized.product <= 0 || !recognized.paidAt) return [];

      const allocations = allocateAmounts(lineTotals, recognized.product);
      return order.items.flatMap((item, index) => {
        const revenue = allocations[index] ?? 0;
        if (revenue <= 0) return [];
        const lineTotal = lineTotals[index] ?? 0;
        const priced = profitBreakdownFromLine({
          orderType: order.type,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          liveCost: item.watch.cost,
          costSnapshot: order.specialCostSnapshot,
          commissionPercent,
        });
        const ratio = lineTotal > 0 ? revenue / lineTotal : 0;
        const cost = ratio >= 1 ? priced.cost : Math.round(priced.cost * ratio);
        const grossProfit = revenue - cost;
        const commission = Math.round(
          grossProfit * (commissionPercent / 100),
        );
        return [
          {
            orderId: order.id,
            readableId: order.readableId,
            orderType: order.type,
            orderStatus: order.status ?? OrderStatus.PENDIENTE,
            priceType: item.priceType,
            productName: item.productName,
            quantity: item.quantity,
            revenue,
            cost,
            profit: grossProfit - commission,
            commissionPercent,
            commission,
            paidAt: recognized.paidAt.toISOString(),
          },
        ];
      });
    });

    const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
    const totalCost = items.reduce((s, i) => s + i.cost, 0);
    const totalGrossProfit = totalRevenue - totalCost;
    const totalCommission = items.reduce((s, i) => s + i.commission, 0);
    const totalProfit = totalGrossProfit - totalCommission;
    const totalReinvestmentFund = Math.round(
      totalProfit * (reinvestmentPercent / 100),
    );
    const totalOwnerProfit = Math.round(
      totalProfit * (ownerProfitPercent / 100),
    );

    const shippingItems = orders.flatMap((order) => {
      const lineSum = order.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const recognized = recognizeCollected({
        subtotal: order.subtotal || lineSum,
        shippingCost: order.shippingCost,
        events: cashEventsForOrder({
          ...order,
          total: order.total || (order.subtotal || lineSum) + order.shippingCost,
        }),
        since,
      });
      if (recognized.shipping <= 0 || !recognized.paidAt) return [];

      return [
        {
          orderId: order.id,
          readableId: order.readableId,
          orderType: order.type,
          orderStatus: order.status ?? OrderStatus.PENDIENTE,
          shippingCost: recognized.shipping,
          shippingZoneName: order.shippingZone?.name ?? null,
          paidAt: recognized.paidAt.toISOString(),
        },
      ];
    });

    const totalShippingRevenue = shippingItems.reduce(
      (sum, item) => sum + item.shippingCost,
      0,
    );

    return {
      period,
      totalRevenue,
      totalCost,
      totalGrossProfit,
      totalProfit,
      totalCommission,
      totalReinvestmentFund,
      totalOwnerProfit,
      reinvestmentPercent,
      ownerProfitPercent,
      commissionPercent,
      totalInventoryInvestment,
      totalShippingRevenue,
      items,
      shippingItems,
    };
  }

  async getHealthDashboard(
    period: 'day' | '2weeks' | 'week' | 'month' | '3months' | 'all' = 'month',
  ): Promise<HealthDashboardDto> {
    await this.preOrdersService.suspendExpiredPreOrders();

    const since = this.periodStart(period);
    const previousRange = this.previousPeriodRange(period);
    const periodLabel = this.healthPeriodLabel(period);
    const oneHourAgo = new Date(
      Date.now() - PRE_ORDER_ALERT_HOURS * 60 * 60 * 1000,
    );
    const activePreOrderWhere = {
      stage: OrderStage.PRE_ORDER,
      canceledAt: null,
      suspendedAt: null,
      depositConfirmed: false,
    };
    const suspendedPreOrderWhere = {
      stage: OrderStage.PRE_ORDER,
      canceledAt: null,
      suspendedAt: { not: null },
      depositConfirmed: false,
    };

    const longWaitingPreOrderWhere = {
      ...activePreOrderWhere,
      preOrderActiveAt: { lt: oneHourAgo },
    };

    const paidOrdersWhere = {
      status: {
        in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO],
      },
      ...(since ? { paidAt: { gte: since } } : {}),
    };

    const previousPaidOrdersWhere = previousRange
      ? {
          status: {
            in: [
              OrderStatus.PAGADO,
              OrderStatus.ENVIADO,
              OrderStatus.ENTREGADO,
            ],
          },
          paidAt: { gte: previousRange.since, lt: previousRange.until },
        }
      : null;

    const [
      activePreOrders,
      suspendedPreOrdersCount,
      paidOrders,
      activeWatches,
      inventoryAggregate,
      longWaitingPreOrdersCount,
      unattendedOrders,
      suspendedOrders,
      paidOrdersInPeriod,
      ordersToShip,
      previousPaidOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: activePreOrderWhere }),
      this.prisma.order.count({ where: suspendedPreOrderWhere }),
      this.prisma.order.count({ where: paidOrdersWhere }),
      this.prisma.watch.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.watch.aggregate({
        where: { isActive: true, deletedAt: null },
        _sum: { stock: true },
      }),
      this.prisma.order.count({ where: longWaitingPreOrderWhere }),
      this.prisma.order.findMany({
        where: longWaitingPreOrderWhere,
        include: { items: true },
        orderBy: { preOrderActiveAt: 'asc' },
        take: 5,
      }),
      this.prisma.order.findMany({
        where: suspendedPreOrderWhere,
        include: { items: true },
        orderBy: { suspendedAt: 'desc' },
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
    ]);

    const topSoldMap = new Map<string, number>();
    for (const order of paidOrdersInPeriod) {
      for (const item of order.items) {
        topSoldMap.set(
          item.watchId,
          (topSoldMap.get(item.watchId) ?? 0) + item.quantity,
        );
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
    const topWatchMap = new Map(
      topWatchRecords.map((watch) => [watch.id, watch]),
    );
    const now = Date.now();
    const totalInventoryUnits = inventoryAggregate._sum.stock ?? 0;
    const inventoryLowAlert =
      totalInventoryUnits <= GLOBAL_INVENTORY_LOW_THRESHOLD;
    const [periodRevenue, previousPeriodRevenue] = await Promise.all([
      this.sumCashIncome(since, null),
      previousRange
        ? this.sumCashIncome(previousRange.since, previousRange.until)
        : Promise.resolve(0),
    ]);
    const unitsSold = paidOrdersInPeriod.reduce(
      (sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const chartTo = new Date();
    const paidChartOrders = paidOrdersInPeriod
      .filter((order) => order.paidAt)
      .sort((a, b) => a.paidAt!.getTime() - b.paidAt!.getTime());
    const chartFrom =
      since ??
      (paidChartOrders.length
        ? new Date(paidChartOrders[0].paidAt!.getTime())
        : new Date(chartTo.getTime() - 7 * 86400000));

    return {
      period,
      metrics: [],
      periodLabel,
      business: {
        preOrders: activePreOrders,
        activePreOrders,
        suspendedPreOrders: suspendedPreOrdersCount,
        longWaitingPreOrders: longWaitingPreOrdersCount,
        paidOrders,
        activeWatches,
        totalInventoryUnits,
        inventoryLowAlert,
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
        waitHours: Math.max(
          0,
          Math.round((now - order.preOrderActiveAt.getTime()) / 3600000),
        ),
        activeSince: order.preOrderActiveAt.toISOString(),
      })),
      suspendedPreOrders: suspendedOrders.map((order) => ({
        id: order.id,
        readableId: order.readableId,
        customerName: order.customerName,
        model: order.items[0]?.productName ?? 'Pedido',
        waitHours: Math.max(
          0,
          Math.round(
            (now -
              (order.suspendedAt?.getTime() ??
                order.preOrderActiveAt.getTime())) /
              3600000,
          ),
        ),
        activeSince: (
          order.suspendedAt ?? order.preOrderActiveAt
        ).toISOString(),
      })),
      inventoryAlert: {
        totalUnits: totalInventoryUnits,
        threshold: GLOBAL_INVENTORY_LOW_THRESHOLD,
        isLow: inventoryLowAlert,
      },
      topWatches: topSold.map((row) => {
        const watch = topWatchMap.get(row.watchId);
        return {
          id: row.watchId,
          model: watch?.model ?? 'Reloj eliminado',
          brand: watch?.brand.name ?? '—',
          reference: watch?.reference ?? null,
          image:
            watch?.frontImageUrl ??
            watch?.primaryImageUrl ??
            watch?.images[0] ??
            null,
          unitsSold: row.quantity,
          stock: watch?.stock ?? 0,
        };
      }),
    };
  }

  async getRevenueDashboard(
    range: RevenueRange = '1_month',
  ): Promise<RevenueDashboardDto> {
    const since = this.revenueRangeStart(range);
    const points = await this.cashIncomePoints(since, null);
    return {
      range,
      orders: points,
      total: points.reduce((sum, point) => sum + point.total, 0),
    };
  }

  private paidAtRange(
    since: Date | null,
    until: Date | null,
  ): Prisma.DateTimeFilter | undefined {
    if (!since && !until) return undefined;
    return {
      ...(since ? { gte: since } : {}),
      ...(until ? { lt: until } : {}),
    };
  }

  private async sumCashIncome(since: Date | null, until: Date | null) {
    const points = await this.cashIncomePoints(since, until);
    return points.reduce((sum, point) => sum + point.total, 0);
  }

  private async cashIncomePoints(
    since: Date | null,
    until: Date | null,
  ): Promise<RevenueOrderPointDto[]> {
    const paidAt = this.paidAtRange(since, until);
    const [payments, legacy] = await Promise.all([
      this.prisma.orderPayment.findMany({
        where: {
          ...(paidAt ? { paidAt } : {}),
          order: { canceledAt: null, stage: OrderStage.ORDER },
        },
        include: {
          order: {
            select: {
              readableId: true,
              customerName: true,
              status: true,
              items: { select: { productName: true } },
            },
          },
        },
        orderBy: { paidAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: {
          canceledAt: null,
          stage: OrderStage.ORDER,
          payments: { none: {} },
          OR: [
            {
              status: {
                in: [
                  OrderStatus.PAGADO,
                  OrderStatus.ENVIADO,
                  OrderStatus.ENTREGADO,
                ],
              },
              ...(paidAt ? { paidAt } : { paidAt: { not: null } }),
            },
            {
              type: OrderType.ESPECIAL,
              ...(paidAt
                ? {
                    OR: [
                      { paidAt },
                      { paidAt: null, createdAt: paidAt },
                    ],
                  }
                : {}),
            },
            {
              depositConfirmed: true,
              status: OrderStatus.PENDIENTE,
              ...(paidAt ? { updatedAt: paidAt } : {}),
            },
          ],
        },
        include: { items: { select: { productName: true } } },
      }),
    ]);

    const paymentPoints: RevenueOrderPointDto[] = payments.map((payment) => ({
      id: payment.id,
      readableId: `${payment.order.readableId} · ${payment.type === 'ABONO' ? 'Abono' : 'Saldo'}`,
      customerName: payment.order.customerName,
      productSummary: payment.order.items
        .map((item) => item.productName)
        .join(', '),
      paidAt: payment.paidAt.toISOString(),
      total: payment.amount,
    }));

    const legacyPoints: RevenueOrderPointDto[] = legacy.flatMap((order) => {
      const events = cashEventsForOrder(order);
      return events
        .filter((event) => {
          if (since && event.paidAt < since) return false;
          if (until && event.paidAt >= until) return false;
          return true;
        })
        .map((event) => ({
          id: order.id,
          readableId: order.readableId,
          customerName: order.customerName,
          productSummary: order.items
            .map((item) => item.productName)
            .join(', '),
          paidAt: event.paidAt.toISOString(),
          total: event.amount,
        }));
    });

    return [...paymentPoints, ...legacyPoints].sort((a, b) =>
      a.paidAt.localeCompare(b.paidAt),
    );
  }

  private revenueRangeStart(range: RevenueRange): Date | null {
    const now = new Date();
    if (range === 'today')
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === '1_week') return new Date(now.getTime() - 7 * 86400000);
    if (range === '1_month')
      return new Date(now.getFullYear(), now.getMonth(), 1);
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
    if (period === 'day')
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === '2weeks') return new Date(now.getTime() - 14 * 86400000);
    if (period === 'week') return new Date(now.getTime() - 7 * 86400000);
    if (period === 'month')
      return new Date(now.getFullYear(), now.getMonth(), 1);
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
      return {
        since: new Date(now.getTime() - 28 * 86400000),
        until: twoWeeksAgo,
      };
    }
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      return { since: new Date(now.getTime() - 14 * 86400000), until: weekAgo };
    }
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        since: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        until: monthStart,
      };
    }
    if (period === '3months') {
      const threeMonthsAgo = new Date(now.getTime() - 90 * 86400000);
      return {
        since: new Date(now.getTime() - 180 * 86400000),
        until: threeMonthsAgo,
      };
    }
    return null;
  }
}
