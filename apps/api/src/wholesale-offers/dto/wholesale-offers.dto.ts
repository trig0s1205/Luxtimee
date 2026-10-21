import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { sanitizePlainTextOptional } from '../../common/utils/sanitize-text.util';

export class UpsertWholesaleExtraDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 40) ?? '')
  name!: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWholesaleExtraDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 40) ?? '')
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertWholesalePackageDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 80) ?? '')
  name!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  minQuantity!: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  watchIds?: string[];
}

export class UpdateWholesalePackageDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 80) ?? '')
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  watchIds?: string[];
}

export class QuoteExtraDto {
  @IsString()
  extraId!: string;

  @IsInt()
  @Min(0)
  @Max(99)
  @Type(() => Number)
  quantity!: number;
}
