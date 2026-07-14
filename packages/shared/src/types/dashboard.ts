export interface ProfitBreakdownItem {
  orderId: string;
  readableId: string;
  productName: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  profitPercent: number;
  commission: number;
  paidAt: string;
}

export interface ProfitDashboardDto {
  period: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalCommission: number;
  items: ProfitBreakdownItem[];
}

export interface HealthMetricDto {
  key: string;
  label: string;
  current: number;
  previous: number;
  changePercent: number;
}

export interface HealthDashboardDto {
  metrics: HealthMetricDto[];
  periodLabel: string;
}
