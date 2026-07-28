export type WarrantyHistoryStatus = 'VENTA_ENTREGADA' | 'GARANTIA_REGISTRADA';
export type WarrantyReplacementType = 'SAME_WATCH' | 'OTHER_WATCH';
export type WarrantyHistoryPeriod = 'day' | 'week' | 'month' | 'all';

export interface WarrantyHistoryDto {
  id: string;
  orderId: string;
  orderItemId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string | null;
  productSku: string;
  productName: string;
  saleDate: string;
  serviceDate: string | null;
  damageDescription: string | null;
  replacementType: WarrantyReplacementType | null;
  replacementSku: string | null;
  replacementNotes: string | null;
  status: WarrantyHistoryStatus;
  registeredById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarrantyHistoriesListDto {
  items: WarrantyHistoryDto[];
  total: number;
  page: number;
  limit: number;
  period: WarrantyHistoryPeriod;
  periodLabel: string;
}

export interface RegisterWarrantyHistoryDto {
  damageDescription: string;
  replacementType: WarrantyReplacementType;
  replacementSku?: string;
  replacementNotes?: string;
}

export interface CreateWarrantyHistoryDto extends RegisterWarrantyHistoryDto {
  orderItemId: string;
}

export interface WarrantyHistoryExportDto {
  period: WarrantyHistoryPeriod;
  periodLabel: string;
  items: WarrantyHistoryDto[];
}
