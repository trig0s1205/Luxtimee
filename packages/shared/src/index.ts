export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  VENDEDOR_LOCAL = 'VENDEDOR_LOCAL',
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
  ESPECIAL = 'ESPECIAL',
}

export enum OrderSource {
  WEB = 'WEB',
  WHATSAPP = 'WHATSAPP',
  MAYORISTA = 'MAYORISTA',
  LOCAL = 'LOCAL',
}

export enum PaymentMethod {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  DATAFONO_BOLD = 'DATAFONO_BOLD',
  NO_ESPECIFICADO = 'NO_ESPECIFICADO',
}

export enum ReceiptChannel {
  WEB = 'WEB',
  LOCAL = 'LOCAL',
}

export enum WarrantyClaimStatus {
  RECIBIDO = 'RECIBIDO',
  EN_REVISION = 'EN_REVISION',
  REPARADO = 'REPARADO',
  REEMPLAZADO = 'REEMPLAZADO',
  RECHAZADO = 'RECHAZADO',
  ENTREGADO = 'ENTREGADO',
}

export enum ExpenseOrigin {
  PLATAFORMA = 'PLATAFORMA',
  LOCAL = 'LOCAL',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.EFECTIVO]: 'Efectivo',
  [PaymentMethod.TRANSFERENCIA]: 'Transferencia',
  [PaymentMethod.DATAFONO_BOLD]: 'Datáfono Bold',
  [PaymentMethod.NO_ESPECIFICADO]: 'No especificado',
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  [OrderSource.WEB]: 'Web',
  [OrderSource.WHATSAPP]: 'WhatsApp',
  [OrderSource.MAYORISTA]: 'Mayorista',
  [OrderSource.LOCAL]: 'Local físico',
};

export const EXPENSE_ORIGIN_LABELS: Record<ExpenseOrigin, string> = {
  [ExpenseOrigin.PLATAFORMA]: 'Plataforma',
  [ExpenseOrigin.LOCAL]: 'Local',
};

export const WARRANTY_CLAIM_STATUS_LABELS: Record<WarrantyClaimStatus, string> = {
  [WarrantyClaimStatus.RECIBIDO]: 'Recibido',
  [WarrantyClaimStatus.EN_REVISION]: 'En revisión',
  [WarrantyClaimStatus.REPARADO]: 'Reparado',
  [WarrantyClaimStatus.REEMPLAZADO]: 'Reemplazado',
  [WarrantyClaimStatus.RECHAZADO]: 'Rechazado',
  [WarrantyClaimStatus.ENTREGADO]: 'Entregado',
};

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
export * from './types/expenses.js';
export * from './types/settings.js';
export * from './types/packaging.js';
export * from './types/dashboard.js';
export * from './utils/order-status.js';
export * from './utils/text.js';
export * from './utils/sku-search.js';
export * from './utils/homepage-hero.js';
export * from './utils/wholesale-quote.js';
export * from './utils/photo-pairs.js';
export * from './utils/bulk-draft-queue.js';
export * from './utils/zip-ntfs.js';
export * from './utils/whatsapp-link.js';
export * from './utils/deposit.js';
export * from './utils/product-watch-name.js';
export * from './types/warranty-history.js';
export * from './types/inventory.js';
export * from './types/wholesale-access.js';
