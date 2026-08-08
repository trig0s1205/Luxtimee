export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export enum OrderStage {
  PRE_ORDER = 'PRE_ORDER',
  ORDER = 'ORDER',
}

export enum OrderStatus {
  PENDIENTE = 'PENDIENTE',
  PAGADO = 'PAGADO',
  ENVIADO = 'ENVIADO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

export enum OrderType {
  DETAL = 'DETAL',
  MAYORISTA = 'MAYORISTA',
}

export enum OrderSource {
  WEB = 'WEB',
  WHATSAPP = 'WHATSAPP',
  MAYORISTA = 'MAYORISTA',
}

export enum MarketingContactStatus {
  PENDING_VALIDATION = 'PENDING_VALIDATION',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
}

export enum CustomerSegment {
  NUEVO = 'NUEVO',
  RECURRENTE = 'RECURRENTE',
  ALTO_VALOR = 'ALTO_VALOR',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
}

export enum PriceType {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
}

export * from './constants.js';
export * from './types/catalog.js';
export * from './types/auth.js';
export * from './types/orders.js';
export * from './types/settings.js';
export * from './types/dashboard.js';
export * from './utils/order-status.js';
export * from './utils/text.js';
export * from './utils/sku-search.js';
export * from './types/warranty-history.js';
export * from './types/inventory.js';
export * from './types/wholesale-access.js';
