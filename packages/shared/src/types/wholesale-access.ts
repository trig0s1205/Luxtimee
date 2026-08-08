export interface WholesaleAccessDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  accessToken: string;
  isActive: boolean;
  grantedAt: string;
  revokedAt: string | null;
  lastAccessAt: string | null;
  notes: string | null;
  accessUrl: string;
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
}

export interface UpdateWholesaleAccessDto {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  isActive?: boolean;
  cookieDurationDays?: number;
}
