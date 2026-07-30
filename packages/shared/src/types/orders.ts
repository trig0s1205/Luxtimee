import type { OrderStage, OrderStatus, OrderType, PriceType } from '../index.js';

export interface CartItemDto {
  watchId: string;
  slug: string;
  productName: string;
  productRef: string;
  productImage: string | null;
  quantity: number;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
}

export interface CreatePreOrderDto {
  customerName: string;
  customerAddress: string;
  customerPhone?: string;
  shippingZoneId?: string;
  consentAccepted: boolean;
  items: Array<{ watchId: string; quantity: number }>;
}

export interface OrderItemDto {
  id: string;
  watchId: string;
  productSku: string;
  productName: string;
  productRef: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  priceType: PriceType;
  warrantyRegistered: boolean;
}

export interface OrderDto {
  id: string;
  readableId: string;
  stage: OrderStage;
  status: OrderStatus | null;
  type: OrderType;
  customerName: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingZoneId: string | null;
  shippingZone?: {
    id: string;
    name: string;
    isNational: boolean;
  } | null;
  shippingCost: number;
  depositExpected: number;
  depositConfirmed: boolean;
  subtotal: number;
  total: number;
  whatsappMessage: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  suspendedAt: string | null;
  preOrderActiveAt: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
}

export interface UpdatePreOrderDto {
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  shippingZoneId?: string;
  items?: Array<{ watchId: string; quantity: number }>;
}

export interface TransitionOrderDto {
  status: OrderStatus;
}

export type OrderListPeriod = 'day' | 'week' | 'month' | 'all';

export interface OrdersListDto {
  items: OrderDto[];
  total: number;
  page: number;
  limit: number;
  period: OrderListPeriod;
  periodLabel: string;
}

export interface PreOrdersListDto {
  items: OrderDto[];
  total: number;
  page: number;
  limit: number;
}

export interface PricingSummary {
  type: OrderType;
  subtotal: number;
  shippingCost: number;
  total: number;
  depositExpected: number;
  unitCount: number;
}

export interface PreOrderCountsDto {
  active: number;
  suspended: number;
}
