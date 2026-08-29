import { IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizePlainTextOptional } from '../../common/utils/sanitize-text.util';

export class FaqItemDto {
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 500) ?? '')
  question!: string;

  @IsString()
  @MinLength(1)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 4000) ?? '')
  answer!: string;
}
