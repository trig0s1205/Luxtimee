import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ORIGINS = ['PLATAFORMA', 'LOCAL'] as const;

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  @Matches(DATE)
  spentAt?: string;

  @IsOptional()
  @IsIn(ORIGINS)
  origin?: (typeof ORIGINS)[number];
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE)
  spentAt?: string;

  @IsOptional()
  @IsIn(ORIGINS)
  origin?: (typeof ORIGINS)[number];
}

export class ExpensesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsIn(ORIGINS)
  origin?: (typeof ORIGINS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

export class ExpenseSummaryQueryDto {
  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsIn(ORIGINS)
  origin?: (typeof ORIGINS)[number];
}
