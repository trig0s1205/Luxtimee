import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { OrderSource, OrderStatus, OrderType } from '@prisma/client';

const ORDER_PERIODS = ['day', 'week', 'month', 'all'] as const;
const ORDER_STATUSES = [
  'PENDIENTE',
  'PAGADO',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO',
] as const;
const ORDER_TYPES = ['DETAL', 'MAYORISTA'] as const;
const ORDER_SOURCES = ['WEB', 'WHATSAPP', 'MAYORISTA', 'LOCAL'] as const;

export type OrdersPeriod = (typeof ORDER_PERIODS)[number];

export class OrdersQueryDto {
  @IsOptional()
  @IsIn(ORDER_PERIODS)
  period?: OrdersPeriod;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @IsOptional()
  @IsIn(ORDER_TYPES)
  type?: OrderType;

  @IsOptional()
  @IsIn(ORDER_SOURCES)
  source?: OrderSource;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
