import { IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizePlainText } from '../../common/utils/sanitize-text.util';

export class CreateMechanismDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  name!: string;
}

export class UpdateMechanismDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  name!: string;
}
