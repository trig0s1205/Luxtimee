export interface ProfitBreakdownItem {
  orderId: string;
  readableId: string;
  orderType: string;
  orderStatus: string;
  priceType: string;
  productName: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  commissionPercent: number;
  commission: number;
  paidAt: string;
}

export interface ShippingBreakdownItem {
  orderId: string;
  readableId: string;
  orderType: string;
  orderStatus: string;
  shippingCost: number;
  shippingZoneName: string | null;
  paidAt: string;
}

export interface ProfitDashboardDto {
  period: string;
  totalRevenue: number;
  totalCost: number;
  totalGrossProfit: number;
  totalProfit: number;
  totalCommission: number;
  totalReinvestmentFund: number;
  totalOwnerProfit: number;
  reinvestmentPercent: number;
  ownerProfitPercent: number;
  commissionPercent: number;
  totalInventoryInvestment: number;
  totalShippingRevenue: number;
  items: ProfitBreakdownItem[];
  shippingItems: ShippingBreakdownItem[];
}

export type ProfitReportPeriod = 'day' | 'week' | 'month';

export interface ReportOwnerDto {
  name: string;
  email: string;
  phone: string | null;
}

export interface HealthMetricDto {
  key: string;
  label: string;
  current: number;
  previous: number;
  changePercent: number;
}

export interface Ga4EngagementDto {
  periodLabel: string;
  metrics: HealthMetricDto[];
  source: 'live' | 'mock';
  error?: string | null;
}

export interface Ga4StatusDto {
  configured: boolean;
  connected: boolean;
  propertyId: string | null;
  clientEmail: string | null;
  error: string | null;
}

export interface HealthBusinessDto {
  preOrders: number;
  activePreOrders: number;
  suspendedPreOrders: number;
  longWaitingPreOrders: number;
  paidOrders: number;
  activeWatches: number;
  totalInventoryUnits: number;
  inventoryLowAlert: boolean;
  ordersToShip: number;
  periodRevenue: number;
  unitsSold: number;
  previousPaidOrders: number;
  previousPeriodRevenue: number;
}

export interface HealthUnattendedPreOrderDto {
  id: string;
  readableId: string;
  customerName: string;
  model: string;
  waitHours: number;
  activeSince: string;
}

export interface HealthInventoryAlertDto {
  totalUnits: number;
  threshold: number;
  isLow: boolean;
}

export interface HealthTopWatchDto {
  id: string;
  model: string;
  brand: string;
  reference: string | null;
  image: string | null;
  unitsSold: number;
  stock: number;
}

export interface HealthChartOrderDto {
  id: string;
  readableId: string;
  customerName: string;
  total: number;
  status: string;
  productSummary: string;
  paidAt: string;
}

export interface HealthChartBoundsDto {
  from: string;
  to: string;
}

export interface HealthDashboardDto {
  period: string;
  metrics: HealthMetricDto[];
  periodLabel: string;
  business: HealthBusinessDto;
  chartBounds: HealthChartBoundsDto;
  chartOrders: HealthChartOrderDto[];
  unattendedPreOrders: HealthUnattendedPreOrderDto[];
  suspendedPreOrders: HealthUnattendedPreOrderDto[];
  inventoryAlert: HealthInventoryAlertDto;
  topWatches: HealthTopWatchDto[];
}

export type RevenueRange = 'today' | '1_week' | '1_month' | 'historical';

export interface RevenueOrderPointDto {
  id: string;
  readableId: string;
  customerName: string;
  productSummary: string;
  paidAt: string;
  total: number;
}

export interface RevenueDashboardDto {
  range: RevenueRange;
  orders: RevenueOrderPointDto[];
  total: number;
}
