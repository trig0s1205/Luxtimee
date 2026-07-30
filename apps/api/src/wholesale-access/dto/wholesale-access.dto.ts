import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { Uppercase, UppercaseOptional } from '../../common/decorators/uppercase.decorator';
import {
  MAX_WHOLESALE_COOKIE_DAYS,
  MIN_WHOLESALE_COOKIE_DAYS,
} from '@luxtime/shared';
import { sanitizePlainTextOptional } from '../../common/utils/sanitize-text.util';

export class CreateWholesaleAccessBodyDto {
  @IsString()
  @Uppercase()
  name!: string;

  @IsEmail()
  email!: string;

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
}

export class ActivateWholesaleSessionDto {
  @IsString()
  token!: string;
}
