import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
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
  @IsISO8601({}, { message: 'Fecha de inicio inválida' })
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601({}, { message: 'Fecha de fin inválida' })
  endsAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
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
  @IsISO8601({}, { message: 'Fecha de inicio inválida' })
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601({}, { message: 'Fecha de fin inválida' })
  endsAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
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
