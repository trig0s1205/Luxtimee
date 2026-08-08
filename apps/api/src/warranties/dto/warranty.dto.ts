import { IsInt, IsString, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizePlainText } from '../../common/utils/sanitize-text.util';

export class CreateWarrantyTemplateDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  name!: string;

  @IsInt()
  @Min(1)
  durationMonths!: number;

  @IsString()
  @MinLength(10)
  @Transform(({ value }) => sanitizePlainText(value, 8000))
  terms!: string;
}

export class UpdateWarrantyTemplateDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  name?: string;

  @IsInt()
  @Min(1)
  durationMonths?: number;

  @IsString()
  @MinLength(10)
  @Transform(({ value }) => sanitizePlainText(value, 8000))
  terms?: string;
}
