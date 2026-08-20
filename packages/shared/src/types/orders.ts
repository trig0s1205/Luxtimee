import type { OrderSource, OrderStage, OrderStatus, OrderType, PriceType } from '../index.js';

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
  deliveryNote?: string;
}

export interface PreOrderItemInput {
  watchId: string;
  quantity: number;
  deliveryNote?: string;
}

export interface CreatePreOrderDto {
  customerName: string;
  customerAddress: string;
  customerPhone?: string;
  shippingZoneId?: string;
  manualShippingCost?: number;
  consentAccepted: boolean;
  items: PreOrderItemInput[];
}

export interface CreateManualPreOrderDto {
  customerName: string;
  customerAddress: string;
  customerPhone?: string;
  shippingZoneId?: string;
  manualShippingCost?: number;
  items: PreOrderItemInput[];
}

export interface CustomerOrderHintDto {
  customerName: string;
  customerAddress: string;
  customerPhone: string | null;
  shippingZoneId: string | null;
}

export interface OrderItemDto {
  id: string;
  watchId: string;
  productSku: string;
  productName: string;
  productRef: string;
  productImage: string | null;
  watchThumbnail: string | null;
  quantity: number;
  unitPrice: number;
  priceType: PriceType;
  deliveryNote: string | null;
  warrantyRegistered: boolean;
}

export interface OrderDto {
  id: string;
  readableId: string;
  stage: OrderStage;
  status: OrderStatus | null;
  type: OrderType;
  source: OrderSource;
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
  manualShippingCost?: number;
  items?: PreOrderItemInput[];
}

export interface UpdateOrderDto {
  customerAddress?: string;
  shippingCost?: number;
  status?: string;
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
