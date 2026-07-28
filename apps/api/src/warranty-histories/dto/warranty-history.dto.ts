import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Uppercase, UppercaseOptional } from '../../common/decorators/uppercase.decorator';

const PERIODS = ['day', 'week', 'month', 'all'] as const;

export type WarrantyHistoryPeriod = (typeof PERIODS)[number];

export class WarrantyHistoriesQueryDto {
  @IsOptional()
  @IsIn(PERIODS)
  period?: WarrantyHistoryPeriod;

  @IsOptional()
  @IsString()
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

export class RegisterWarrantyHistoryDto {
  @IsString()
  @Uppercase()
  damageDescription!: string;

  @IsIn(['SAME_WATCH', 'OTHER_WATCH'])
  replacementType!: 'SAME_WATCH' | 'OTHER_WATCH';

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  replacementSku?: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  replacementNotes?: string;
}

export class CreateWarrantyHistoryDto extends RegisterWarrantyHistoryDto {
  @IsString()
  orderItemId!: string;
}
