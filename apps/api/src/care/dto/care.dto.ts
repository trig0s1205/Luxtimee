import { IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizePlainText } from '../../common/utils/sanitize-text.util';

export class CreateCareTemplateDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  name!: string;

  @IsString()
  @MinLength(10)
  @Transform(({ value }) => sanitizePlainText(value, 8000))
  instructions!: string;
}

export class UpdateCareTemplateDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  name?: string;

  @IsString()
  @MinLength(10)
  @Transform(({ value }) => sanitizePlainText(value, 8000))
  instructions?: string;
}
