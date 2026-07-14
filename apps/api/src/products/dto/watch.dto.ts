import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWatchDto {
  @IsString()
  brandId!: string;

  @IsString()
  @MinLength(2)
  model!: string;

  @IsString()
  @MinLength(2)
  movementType!: string;

  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;

  @IsInt()
  @Min(0)
  retailPrice!: number;

  @IsInt()
  @Min(0)
  wholesalePrice!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  profitPercent?: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsString()
  warrantyTemplateId?: string;

  @IsOptional()
  @IsString()
  careTemplateId?: string;
}

export class UpdateWatchDto {
  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  model?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  movementType?: string;

  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(0)
  retailPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  wholesalePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  profitPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  warrantyTemplateId?: string;

  @IsOptional()
  @IsString()
  careTemplateId?: string;
}

export class UpdateStockDto {
  @IsInt()
  @Min(0)
  stock!: number;
}
