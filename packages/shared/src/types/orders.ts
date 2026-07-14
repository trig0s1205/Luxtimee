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
  customerEmail: string;
  customerPhone?: string;
  shippingZoneId?: string;
  consentAccepted: boolean;
  items: Array<{ watchId: string; quantity: number }>;
}

export interface OrderItemDto {
  id: string;
  watchId: string;
  productName: string;
  productRef: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  priceType: PriceType;
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
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
}

export interface UpdatePreOrderDto {
  customerName?: string;
  customerAddress?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingZoneId?: string;
  items?: Array<{ watchId: string; quantity: number }>;
}

export interface TransitionOrderDto {
  status: OrderStatus;
}

export interface PricingSummary {
  type: OrderType;
  subtotal: number;
  shippingCost: number;
  total: number;
  depositExpected: number;
  unitCount: number;
}
