import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Uppercase, UppercaseOptional } from '../../common/decorators/uppercase.decorator';
import { sanitizePlainTextOptional } from '../../common/utils/sanitize-text.util';
import { Transform } from 'class-transformer';

export class PreOrderItemDto {
  @IsString()
  watchId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 500))
  deliveryNote?: string;
}

export class CreatePreOrderDto {
  @IsString()
  @Uppercase()
  customerName!: string;

  @IsString()
  @Uppercase()
  customerAddress!: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  shippingZoneId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  manualShippingCost?: number;

  @IsBoolean()
  consentAccepted!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreOrderItemDto)
  items!: PreOrderItemDto[];
}

export class CreateManualPreOrderDto {
  @IsString()
  @Uppercase()
  customerName!: string;

  @IsString()
  @Uppercase()
  customerAddress!: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  shippingZoneId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  manualShippingCost?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreOrderItemDto)
  items!: PreOrderItemDto[];
}

export class UpdatePreOrderDto {
  @IsOptional()
  @IsString()
  @UppercaseOptional()
  customerName?: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  customerAddress?: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  shippingZoneId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  manualShippingCost?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreOrderItemDto)
  items?: PreOrderItemDto[];
}

export class TransitionOrderDto {
  @IsString()
  status!: string;
}
