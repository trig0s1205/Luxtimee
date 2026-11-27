import { Injectable } from '@nestjs/common';
import { OrderSource, OrderStage, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { cashEventsForOrder } from '../orders/order-payments.util';
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
import {
  channelForSource,
  summarizeProfitByChannel,
} from './profit-channel.util';
import {
  linesFromOrder,
  payrollFund,
  profitPeriodRange,
  type ProfitChannelFilter,
  type ProfitOrderInput,
  type ProfitPeriod,
} from './profit-math';

@Injectable()
export class DashboardsService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private preOrdersService: PreOrdersService,
  ) {}

  async getProfitDashboard(
    period: ProfitPeriod = 'month',
    channel: ProfitChannelFilter = 'ALL',
  ): Promise<ProfitDashboardDto> {
    const since = profitPeriodRange(period).since;
    const payrollLoader = (
      this.settingsService as {
        getPayrollConfig?: () => Promise<{
          workers?: Array<{ name?: string; monthlySalary?: number }>;
        }>;
      }
    ).getPayrollConfig;
    const [commissionConfig, profitConfig, payrollConfig] = await Promise.all([
      this.settingsService.getCommissionConfig(),
      this.settingsService.getProfitConfig(),
      payrollLoader ? payrollLoader.call(this.settingsService) : Promise.resolve({ workers: [] }),
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

    const [orders, inventoryWatches, expenses] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          stage: OrderStage.ORDER,
          canceledAt: null,
          hiddenAt: null,
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
          items: { include: { watch: { include: { brand: { select: { name: true } } } } } },
          shippingZone: { select: { name: true } },
          seller: { select: { name: true } },
          payments: { select: { amount: true, paidAt: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.watch.findMany({
        where: { deletedAt: null },
        select: { cost: true, stock: true },
      }),
      this.loadExpenses(since),
    ]);

    const totalInventoryInvestment = inventoryWatches.reduce(
      (sum, watch) => sum + (watch.cost ?? 0) * watch.stock,
      0,
    );

    const monthRange = profitPeriodRange('month');
    const payrollOrders =
      period === 'day' || period === 'week'
        ? await this.prisma.order.findMany({
            where: {
              stage: OrderStage.ORDER,
              canceledAt: null,
              hiddenAt: null,
              status: { in: activeStatuses },
              ...(monthRange.since
                ? {
                    OR: [
                      { payments: { some: { paidAt: { gte: monthRange.since } } } },
                      { paidAt: { gte: monthRange.since } },
                      { createdAt: { gte: monthRange.since } },
                      { updatedAt: { gte: monthRange.since } },
                    ],
                  }
                : {}),
            },
            include: {
              items: { include: { watch: { include: { brand: { select: { name: true } } } } } },
              seller: { select: { name: true } },
              payments: { select: { amount: true, paidAt: true, method: true } },
            },
          })
        : orders;
    const built = (orders as ProfitOrderInput[]).map((order) =>
      linesFromOrder(order, since),
    );
    const monthLines = (payrollOrders as ProfitOrderInput[]).flatMap(
      (order) => linesFromOrder(order, monthRange.since).lines,
    );
    const allLines = built.flatMap((row) => row.lines);
    const lines =
      channel === 'ALL' ? allLines : allLines.filter((line) => line.channel === channel);

    const shippingItems = built.flatMap((row, index) => {
      const order = orders[index];
      if (row.shipping <= 0 || !row.paidAt) return [];
      const lineChannel = channelForSource(order.source);
      if (channel !== 'ALL' && lineChannel !== channel) return [];
      return [
        {
          orderId: order.id,
          readableId: order.readableId,
          orderType: order.type,
          orderStatus: order.status ?? OrderStatus.PENDIENTE,
          shippingCost: row.shipping,
          shippingZoneName: order.shippingZone?.name ?? null,
          channel: lineChannel,
          paidAt: row.paidAt,
        },
      ];
    });

    const known = lines.filter((line) => line.costStatus !== 'MISSING');
    const grossSales = lines.reduce((sum, line) => sum + line.gross, 0);
    const discounts = lines.reduce((sum, line) => sum + line.discount, 0);
    const totalRevenue = lines.reduce((sum, line) => sum + line.revenue, 0);
    const totalCost = known.reduce((sum, line) => sum + line.cost, 0);
    const knownRevenue = known.reduce((sum, line) => sum + line.revenue, 0);
    const totalGrossProfit = knownRevenue - totalCost;
    const expenseRows = expenses.filter((expense) =>
      this.expenseMatchesChannel(expense.origin, channel),
    );
    const payrollExpenseRows = expenseRows.filter(
      (expense) => expense.category === 'NOMINA',
    );
    const operatingRows = expenseRows.filter(
      (expense) => expense.category !== 'NOMINA',
    );
    const operatingExpenses = operatingRows.reduce((sum, row) => sum + row.amount, 0);
    const payrollExpenses = payrollExpenseRows.reduce((sum, row) => sum + row.amount, 0);
    const totalProfit = totalGrossProfit - operatingExpenses;
    const totalCommission = 0;
    const totalReinvestmentFund = Math.round(
      totalProfit * (reinvestmentPercent / 100),
    );
    const totalOwnerProfit = Math.round(
      totalProfit * (ownerProfitPercent / 100),
    );
    const totalShippingRevenue = shippingItems.reduce(
      (sum, item) => sum + item.shippingCost,
      0,
    );
    const orderIds = new Set(lines.map((line) => line.orderId));
    const units = lines.reduce((sum, line) => sum + line.quantity, 0);
    const missing = lines.filter((line) => line.costStatus === 'MISSING');
    const monthChannel = channel === 'ALL'
      ? monthLines
      : monthLines.filter((line) => line.channel === channel);
    const payrollTotal = (payrollConfig.workers ?? []).reduce(
      (sum, worker) => sum + Math.max(0, Math.round(worker.monthlySalary ?? 0)),
      0,
    );
    const fund = payrollFund({
      invoiced: monthLines.reduce((sum, line) => sum + line.revenue, 0),
      percent: commissionPercent,
      payroll: payrollTotal,
      channelInvoiced: monthChannel.reduce((sum, line) => sum + line.revenue, 0),
    });

    const items = lines.map((line) => ({
      orderId: line.orderId,
      readableId: line.readableId,
      orderType: line.orderType,
      orderStatus: line.orderStatus,
      priceType: 'RETAIL',
      productName: line.productName,
      productSku: line.productSku,
      quantity: line.quantity,
      revenue: line.revenue,
      gross: line.gross,
      discount: line.discount,
      cost: line.costStatus === 'MISSING' ? 0 : line.cost,
      profit: line.costStatus === 'MISSING' ? 0 : line.profit,
      commissionPercent: 0,
      commission: 0,
      channel: line.channel,
      paidAt: line.paidAt,
      costStatus: line.costStatus,
      brand: line.brand,
      watchId: line.watchId,
    }));

    const byChannel = summarizeProfitByChannel(items, shippingItems);
    this.applyChannelExpenses(byChannel, expenses);

    return {
      period,
      channel,
      rangeFrom: since?.toISOString() ?? null,
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
      grossSales,
      discounts,
      netSales: totalRevenue,
      marginPercent: knownRevenue > 0 ? (totalGrossProfit / knownRevenue) * 100 : null,
      operatingExpenses,
      payrollExpenses,
      units,
      orderCount: orderIds.size,
      averageTicket: orderIds.size > 0 ? Math.round(totalRevenue / orderIds.size) : 0,
      missingCostCount: missing.length,
      missingCostRevenue: missing.reduce((sum, line) => sum + line.revenue, 0),
      missingCostItems: missing.map((line) => ({
        orderId: line.orderId,
        readableId: line.readableId,
        productName: line.productName,
        productSku: line.productSku,
        watchId: line.watchId,
        quantity: line.quantity,
        revenue: line.revenue,
      })),
      topWatches: this.rankTops(known, (line) => line.productSku || line.productName, (line) => line.productName),
      topBrands: this.rankTops(
        known.filter((line) => line.brand),
        (line) => line.brand || '',
        (line) => line.brand || '',
      ),
      paymentMethods: this.paymentBreakdown(orders, lines, since),
      cashExpenses: operatingRows
        .filter((row) => row.paidWithCash)
        .reduce((sum, row) => sum + row.amount, 0),
      payroll: {
        ...fund,
        payrollExpensesPaid: payrollExpenses,
        workers: (payrollConfig.workers ?? []).map((worker) => ({
          name: worker.name ?? '',
          monthlySalary: Math.max(0, Math.round(worker.monthlySalary ?? 0)),
        })),
      },
      byChannel,
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

  private async loadExpenses(since: Date | null) {
    const finder = this.prisma.expense?.findMany;
    if (!finder) return [] as Array<{
      amount: number;
      origin: string;
      category: string | null;
      paidWithCash: boolean;
      spentAt: Date;
      name: string;
    }>;
    return finder.call(this.prisma.expense, {
      where: since ? { spentAt: { gte: since } } : {},
      select: {
        amount: true,
        origin: true,
        category: true,
        paidWithCash: true,
        spentAt: true,
        name: true,
      },
    });
  }

  private expenseMatchesChannel(origin: string, channel: ProfitChannelFilter) {
    if (channel === 'LOCAL') return origin === 'LOCAL';
    if (channel === 'WEB') return origin === 'PLATAFORMA';
    return true;
  }

  private applyChannelExpenses(
    byChannel: ProfitDashboardDto['byChannel'],
    expenses: Array<{ amount: number; origin: string; category: string | null }>,
  ) {
    const operating = expenses.filter((row) => row.category !== 'NOMINA');
    const local = operating
      .filter((row) => row.origin === 'LOCAL')
      .reduce((sum, row) => sum + row.amount, 0);
    const web = operating
      .filter((row) => row.origin === 'PLATAFORMA')
      .reduce((sum, row) => sum + row.amount, 0);
    byChannel.local.profit -= local;
    byChannel.web.profit -= web;
    byChannel.total.profit -= local + web;
  }

  private rankTops<T extends { quantity: number; profit: number; revenue: number }>(
    lines: T[],
    keyOf: (line: T) => string,
    labelOf: (line: T) => string,
  ) {
    const map = new Map<string, { label: string; units: number; profit: number; revenue: number }>();
    for (const line of lines) {
      const key = keyOf(line);
      if (!key) continue;
      const row = map.get(key) ?? { label: labelOf(line), units: 0, profit: 0, revenue: 0 };
      row.units += line.quantity;
      row.profit += line.profit;
      row.revenue += line.revenue;
      map.set(key, row);
    }
    return [...map.values()]
      .sort((a, b) => b.profit - a.profit || b.units - a.units)
      .slice(0, 5);
  }

  private paymentBreakdown(
    orders: Array<{ id: string; payments?: Array<{ amount: number; paidAt: Date | string; method?: string | null }> | null }>,
    lines: Array<{ orderId: string }>,
    since: Date | null,
  ) {
    const ids = new Set(lines.map((line) => line.orderId));
    const totals: Record<string, number> = {};
    for (const order of orders) {
      if (!ids.has(order.id)) continue;
      for (const payment of order.payments ?? []) {
        const at = new Date(payment.paidAt);
        if (since && at < since) continue;
        const method = payment.method || 'NO_ESPECIFICADO';
        totals[method] = (totals[method] ?? 0) + payment.amount;
      }
    }
    return Object.entries(totals).map(([method, amount]) => ({ method, amount }));
  }

  async listFinancialSales(query: {
    channel?: ProfitChannelFilter;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const channel = query.channel ?? 'ALL';
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const since = query.from ? profitPeriodRange('day', new Date(`${query.from}T12:00:00-05:00`)).since : null;
    const until = query.to
      ? new Date((profitPeriodRange('day', new Date(`${query.to}T12:00:00-05:00`)).since ?? new Date()).getTime() + 86400000)
      : null;
    const search = query.search?.trim();
    const activeStatuses = [
      OrderStatus.PENDIENTE,
      OrderStatus.PAGADO,
      OrderStatus.ENVIADO,
      OrderStatus.ENTREGADO,
    ];
    const orders = await this.prisma.order.findMany({
      where: {
        stage: OrderStage.ORDER,
        canceledAt: null,
        hiddenAt: null,
        status: { in: activeStatuses },
        ...(channel === 'LOCAL'
          ? { source: OrderSource.LOCAL }
          : channel === 'WEB'
            ? { source: { not: OrderSource.LOCAL } }
            : {}),
        ...(search
          ? {
              OR: [
                { customerName: { contains: search, mode: 'insensitive' } },
                { readableId: { contains: search, mode: 'insensitive' } },
                { items: { some: { productName: { contains: search, mode: 'insensitive' } } } },
                { items: { some: { productSku: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: {
        items: { include: { watch: { include: { brand: { select: { name: true } } } } } },
        seller: { select: { name: true } },
        payments: { select: { amount: true, paidAt: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const rows = (orders as ProfitOrderInput[])
      .map((order) => {
        const built = linesFromOrder(order, since, until);
        if (!built.lines.length) return null;
        const lines = built.lines;
        const net = lines.reduce((sum, line) => sum + line.revenue, 0);
        const gross = lines.reduce((sum, line) => sum + line.gross, 0);
        const discount = lines.reduce((sum, line) => sum + line.discount, 0);
        const known = lines.filter((line) => line.costStatus !== 'MISSING');
        const cost = known.reduce((sum, line) => sum + line.cost, 0);
        const profit = known.reduce((sum, line) => sum + line.profit, 0);
        const knownRevenue = known.reduce((sum, line) => sum + line.revenue, 0);
        const missing = lines.some((line) => line.costStatus === 'MISSING');
        const estimated = lines.some((line) => line.costStatus === 'ESTIMATED');
        return {
          orderId: order.id,
          readableId: order.readableId,
          paidAt: built.paidAt,
          channel: lines[0].channel,
          sellerName: lines[0].sellerName,
          customerName: order.customerName ?? '',
          image: lines.find((line) => line.productImage)?.productImage ?? null,
          watches: lines.map((line) => line.productName).join(', '),
          paymentMethods: [
            ...new Set((order.payments ?? []).map((payment) => payment.method || 'NO_ESPECIFICADO')),
          ],
          gross,
          discount,
          net,
          cost: missing && known.length === 0 ? null : cost,
          profit: missing && known.length === 0 ? null : profit,
          marginPercent: knownRevenue > 0 ? (profit / knownRevenue) * 100 : null,
          costStatus: missing ? 'MISSING' : estimated ? 'ESTIMATED' : 'SNAPSHOT',
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const totals = rows.reduce(
      (acc, row) => {
        acc.gross += row.gross;
        acc.discount += row.discount;
        acc.net += row.net;
        acc.cost += row.cost ?? 0;
        acc.profit += row.profit ?? 0;
        return acc;
      },
      { gross: 0, discount: 0, net: 0, cost: 0, profit: 0 },
    );
    const start = (page - 1) * limit;
    return {
      items: rows.slice(start, start + limit),
      total: rows.length,
      page,
      limit,
      totals,
    };
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
