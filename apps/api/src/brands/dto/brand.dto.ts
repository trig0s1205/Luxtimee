import { IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Uppercase } from '../../common/decorators/uppercase.decorator';
import { sanitizePlainText } from '../../common/utils/sanitize-text.util';

export class CreateBrandDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  @Uppercase()
  name!: string;
}

export class UpdateBrandDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  @Uppercase()
  name!: string;
}
