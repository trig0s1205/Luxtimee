import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { UppercaseOptional } from '../../common/decorators/uppercase.decorator';
import { sanitizePlainTextOptional } from '../../common/utils/sanitize-text.util';
import { FaqItemDto } from './faq-item.dto';
import { ValidateNested } from 'class-validator';

const WATCH_STATUS_VALUES = ['DISPONIBLE', 'AGOTADO'] as const;
export type WatchStatusValue = (typeof WATCH_STATUS_VALUES)[number];

export class CreateWatchDto {
  @IsString()
  @MinLength(1)
  brandId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  mechanismId?: string;

  @IsString()
  @MinLength(2)
  model!: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  reference?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  warrantyMonths?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  movementType?: string;

  @IsOptional()
  @IsString()
  movementCaliber?: string;

  @IsOptional()
  @IsString()
  caseDiameter?: string;

  @IsOptional()
  @IsString()
  caseMaterial?: string;

  @IsOptional()
  @IsString()
  bezelMaterial?: string;

  @IsOptional()
  @IsString()
  dialColor?: string;

  @IsOptional()
  @IsString()
  crystalType?: string;

  @IsOptional()
  @IsString()
  strapMaterial?: string;

  @IsOptional()
  @IsString()
  waterResistance?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  functions?: string[];

  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  retailPrice!: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  wholesalePrice!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  profitPercent?: number;

  @IsOptional()
  @Type(() => Number)
  retailMarginPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  wholesaleMarginPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  secretaryCommissionPercentage?: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock!: number;

  @IsOptional()
  @IsEnum(WATCH_STATUS_VALUES)
  status?: WatchStatusValue;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  showInCatalog?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isLimitedEdition?: boolean;

  @IsOptional()
  @IsString()
  limitedEditionNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 8000))
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faqs?: FaqItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  mainImageIndex?: number;

  @IsOptional()
  @IsString()
  warrantyTemplateId?: string;

  @IsOptional()
  @IsString()
  careTemplateId?: string;
}
