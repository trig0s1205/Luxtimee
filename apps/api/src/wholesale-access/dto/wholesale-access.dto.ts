import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  Uppercase,
  UppercaseOptional,
} from '../../common/decorators/uppercase.decorator';
import {
  MAX_WHOLESALE_COOKIE_DAYS,
  MIN_WHOLESALE_COOKIE_DAYS,
} from '@luxtime/shared';
import { sanitizePlainTextOptional } from '../../common/utils/sanitize-text.util';

export class CreateWholesaleAccessBodyDto {
  @IsString()
  @Uppercase()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 2000))
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(MIN_WHOLESALE_COOKIE_DAYS)
  @Max(MAX_WHOLESALE_COOKIE_DAYS)
  cookieDurationDays?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsISO8601()
  expiresAt?: string | null;
}

export class UpdateWholesaleAccessBodyDto {
  @IsOptional()
  @IsString()
  @UppercaseOptional()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 2000))
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(MIN_WHOLESALE_COOKIE_DAYS)
  @Max(MAX_WHOLESALE_COOKIE_DAYS)
  cookieDurationDays?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsISO8601()
  expiresAt?: string | null;
}

export class ActivateWholesaleSessionDto {
  @IsString()
  token!: string;
}
