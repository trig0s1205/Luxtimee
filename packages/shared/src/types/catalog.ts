import type { PriceType } from '../index.js';
import type { FaqItem } from './settings.js';

export enum WatchStatus {
  DISPONIBLE = 'DISPONIBLE',
  AGOTADO = 'AGOTADO',
}

export interface WatchSpecs {
  movement?: string;
  caseMaterial?: string;
  caseDiameter?: string;
  waterResistance?: string;
  [key: string]: string | undefined;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
}

export interface MechanismDto {
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
  sku: string;
  slug: string;
  brand: BrandDto;
  category?: CategoryDto | null;
  mechanism?: MechanismDto | null;
  model: string;
  reference?: string | null;
  gender?: string | null;
  warrantyMonths: number;
  movementType: string;
  movementCaliber?: string | null;
  caseDiameter?: string | null;
  caseMaterial?: string | null;
  bezelMaterial?: string | null;
  dialColor?: string | null;
  crystalType?: string | null;
  strapMaterial?: string | null;
  waterResistance?: string | null;
  functions: string[];
  specs: WatchSpecs;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  status: WatchStatus;
  isActive: boolean;
  isPublished: boolean;
  showInCatalog: boolean;
  isLimitedEdition: boolean;
  limitedEditionNumber?: string | null;
  description?: string | null;
  faqs: FaqItem[];
  images: string[];
  mainImageIndex: number;
  primaryImageUrl?: string | null;
  secondaryImageUrl?: string | null;
  videoUrl?: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  warrantyTemplate?: WarrantyTemplateDto | null;
  careTemplate?: CareTemplateDto | null;
  createdAt: string;
}

export interface WatchStaffDto extends WatchPublicDto {
  cost?: number;
  profitPercent?: number;
  retailMarginPercentage?: number;
  wholesaleMarginPercentage?: number;
  secretaryCommissionPercentage?: number;
}

export interface CatalogListQuery {
  brand?: string;
  movement?: string;
  available?: string;
  gender?: string;
  category?: string;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
  minPrice?: number;
  maxPrice?: number;
  search?: string;
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
  categoryId?: string;
  mechanismId?: string;
  model: string;
  reference?: string;
  gender?: string;
  warrantyMonths?: number;
  movementType?: string;
  movementCaliber?: string;
  caseDiameter?: string;
  caseMaterial?: string;
  bezelMaterial?: string;
  dialColor?: string;
  crystalType?: string;
  strapMaterial?: string;
  waterResistance?: string;
  functions?: string[];
  specs?: WatchSpecs;
  retailPrice: number;
  wholesalePrice: number;
  cost?: number;
  profitPercent?: number;
  retailMarginPercentage?: number;
  wholesaleMarginPercentage?: number;
  secretaryCommissionPercentage?: number;
  stock: number;
  status?: WatchStatus;
  isActive?: boolean;
  isPublished?: boolean;
  showInCatalog?: boolean;
  isLimitedEdition?: boolean;
  limitedEditionNumber?: string;
  description?: string;
  faqs?: FaqItem[];
  images?: string[];
  mainImageIndex?: number;
  warrantyTemplateId?: string;
  careTemplateId?: string;
}

export interface UpdateWatchDto extends Partial<CreateWatchDto> {
  isActive?: boolean;
}

export interface WatchQueryDto {
  brand?: string;
  search?: string;
  status?: WatchStatus;
  page?: number;
  limit?: number;
}

export interface InventoryEventPayload {
  watchId: string;
  slug: string;
  model: string;
  previousStock: number;
  newStock: number;
}

export type { PriceType };
