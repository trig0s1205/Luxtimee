import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const RECEIPT_LIST_STATUSES = ['TODOS', 'EMITIDO', 'ANULADO'] as const;
export type ReceiptListStatus = (typeof RECEIPT_LIST_STATUSES)[number];

export class ReceiptListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().slice(0, 100) : value,
  )
  q?: string;

  @IsOptional()
  @IsIn(RECEIPT_LIST_STATUSES)
  status?: ReceiptListStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
