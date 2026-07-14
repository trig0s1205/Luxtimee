import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PreOrderItemDto {
  @IsString()
  watchId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePreOrderDto {
  @IsString()
  customerName!: string;

  @IsString()
  customerAddress!: string;

  @IsEmail()
  customerEmail!: string;

  @IsOptional()
  @IsString()
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
  customerName?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
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
