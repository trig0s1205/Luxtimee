import type { PriceType } from '../index.js';

export interface WatchSpecs {
  movement?: string;
  caseMaterial?: string;
  caseDiameter?: string;
  waterResistance?: string;
  [key: string]: string | undefined;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
}

export interface WarrantyTemplateDto {
  id: string;
  name: string;
  durationMonths: number;
  terms: string;
}

export interface CareTemplateDto {
  id: string;
  name: string;
  instructions: string;
}

export interface WatchPublicDto {
  id: string;
  slug: string;
  brand: BrandDto;
  model: string;
  movementType: string;
  specs: WatchSpecs;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  isActive: boolean;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  warrantyTemplate?: WarrantyTemplateDto | null;
  careTemplate?: CareTemplateDto | null;
  createdAt: string;
}

export interface WatchStaffDto extends WatchPublicDto {
  cost?: number;
  profitPercent?: number;
}

export interface CatalogListQuery {
  brand?: string;
  movement?: string;
  available?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateWatchDto {
  brandId: string;
  model: string;
  movementType: string;
  specs?: WatchSpecs;
  retailPrice: number;
  wholesalePrice: number;
  cost?: number;
  profitPercent?: number;
  stock: number;
  warrantyTemplateId?: string;
  careTemplateId?: string;
}

export interface UpdateWatchDto extends Partial<CreateWatchDto> {
  isActive?: boolean;
}

export interface InventoryEventPayload {
  watchId: string;
  slug: string;
  model: string;
  previousStock: number;
  newStock: number;
}

export type { PriceType };
