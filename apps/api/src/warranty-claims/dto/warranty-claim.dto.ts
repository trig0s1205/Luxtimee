import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WarrantyClaimStatus } from '@prisma/client';
import {
  sanitizePlainText,
  sanitizePlainTextOptional,
} from '../../common/utils/sanitize-text.util';

export class CreateWarrantyClaimDto {
  @IsString()
  @MinLength(1)
  receiptItemId!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainText(value, 2000))
  @MinLength(10, { message: 'Describe el problema (mínimo 10 caracteres)' })
  @MaxLength(2000)
  reportedIssue!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 2000))
  @MaxLength(2000)
  notes?: string;
}

export class UpdateWarrantyClaimStatusDto {
  @IsEnum(WarrantyClaimStatus)
  status!: WarrantyClaimStatus;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 2000))
  @MaxLength(2000)
  note?: string;
}

export class UpdateWarrantyClaimNotesDto {
  @IsString()
  @Transform(({ value }) => sanitizePlainText(value, 2000))
  @MaxLength(2000)
  notes!: string;
}

export class WarrantyClaimsQueryDto {
  @IsOptional()
  @IsEnum(WarrantyClaimStatus)
  status?: WarrantyClaimStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().slice(0, 100) : value,
  )
  q?: string;

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
  limit?: number;
}
