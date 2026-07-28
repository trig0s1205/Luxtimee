import { IsString, MinLength } from 'class-validator';
import { Uppercase } from '../../common/decorators/uppercase.decorator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @Uppercase()
  name!: string;
}

export class UpdateCategoryDto {
  @IsString()
  @MinLength(2)
  @Uppercase()
  name!: string;
}
