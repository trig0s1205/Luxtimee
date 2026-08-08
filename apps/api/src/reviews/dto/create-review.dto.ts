import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { sanitizePlainText } from '../../common/utils/sanitize-text.util';

export class CreateReviewDto {
  @IsString()
  @Transform(({ value }) => sanitizePlainText(value, 120))
  customerName!: string;

  @IsOptional()
  @IsString()
  watchId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @Transform(({ value }) => sanitizePlainText(value, 2000))
  body!: string;
}
