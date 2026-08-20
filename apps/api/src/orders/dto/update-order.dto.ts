import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';
import { UppercaseOptional } from '../../common/decorators/uppercase.decorator';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @UppercaseOptional()
  customerAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  shippingCost?: number;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
