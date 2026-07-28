import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const CATALOG_SORT_VALUES = ['newest', 'oldest', 'price_asc', 'price_desc'] as const;
export type CatalogSortValue = (typeof CATALOG_SORT_VALUES)[number];

function trimOptional({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return undefined;
  return trimmed;
}

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  brand?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  movement?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  available?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  gender?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  category?: string;
  @IsOptional()
  @IsIn(CATALOG_SORT_VALUES)
  sort?: CatalogSortValue;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  search?: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
