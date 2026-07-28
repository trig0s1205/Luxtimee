import { IsString, MinLength } from 'class-validator';
import { Uppercase } from '../../common/decorators/uppercase.decorator';

export class CreateBrandDto {
  @IsString()
  @MinLength(2)
  @Uppercase()
  name!: string;
}

export class UpdateBrandDto {
  @IsString()
  @MinLength(2)
  @Uppercase()
  name!: string;
}
