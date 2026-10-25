export interface WholesaleAccessDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  accessToken: string | null;
  isActive: boolean;
  grantedAt: string;
  revokedAt: string | null;
  lastAccessAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  accessUrl: string | null;
  cookieDurationDays: number;
}

export interface WholesaleAccessListDto {
  items: WholesaleAccessDto[];
  total: number;
}

export interface WholesaleSessionDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CreateWholesaleAccessDto {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  cookieDurationDays?: number;
  expiresAt?: string | null;
}

export interface UpdateWholesaleAccessDto {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  isActive?: boolean;
  cookieDurationDays?: number;
  expiresAt?: string | null;
}

export interface WholesalerReportRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  orders: number;
  units: number;
  revenue: number;
}

export interface WholesalerReportDto {
  items: WholesalerReportRow[];
}

export interface WholesalerOrderHistoryItem {
  id: string;
  readableId: string;
  stage: string;
  status: string | null;
  total: number;
  units: number;
  createdAt: string;
  canceledAt: string | null;
  suspendedAt: string | null;
  depositConfirmed: boolean;
}

export interface WholesalerOrderHistoryDto {
  items: WholesalerOrderHistoryItem[];
  total: number;
  page: number;
  limit: number;
}
