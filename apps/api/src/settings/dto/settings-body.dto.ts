import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { sanitizePlainTextOptional } from '../../common/utils/sanitize-text.util';

export class SetWhatsappBodyDto {
  @IsString()
  @MinLength(8)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  url!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 500) ?? '')
  messagePrefix!: string;
}

export class SetPlatformBodyDto {
  @IsEmail()
  supportEmail!: string;

  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  city!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  instagramUrl!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  tiktokUrl!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  facebookUrl!: string;
}

export class SetProfitBodyDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  reinvestmentPercent!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  ownerProfitPercent!: number;
}

export class SetCommissionBodyDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  percent!: number;
}

export class SetReceiptBodyDto {
  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  businessName!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  ownerName!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  ownerDocument!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  phone!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  whatsapp!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  email!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  city!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  address!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 500) ?? '')
  logoUrl!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 6000) ?? '')
  warrantyTerms!: string;

  @IsString()
  @Transform(({ value }) => sanitizePlainTextOptional(value, 300) ?? '')
  footerNote!: string;
}

export class SetHomepageConfigBodyDto {
  @IsOptional()
  @IsObject()
  hero?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  featured?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  founder?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  valueProps?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  customerProof?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  faq?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  contact?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  landingAds?: unknown[];
}

export class DeleteFounderImageBodyDto {
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  url!: string;
}
