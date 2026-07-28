import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Uppercase, UppercaseOptional } from '../../common/decorators/uppercase.decorator';

export class PreOrderItemDto {
  @IsString()
  watchId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
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

  @IsBoolean()
  consentAccepted!: boolean;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreOrderItemDto)
  items?: PreOrderItemDto[];
}

export class TransitionOrderDto {
  @IsString()
  status!: string;
}
