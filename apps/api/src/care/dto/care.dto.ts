import { IsString, MinLength } from 'class-validator';

export class CreateCareTemplateDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(10)
  instructions!: string;
}

export class UpdateCareTemplateDto {
  @IsString()
  @MinLength(2)
  name?: string;

  @IsString()
  @MinLength(10)
  instructions?: string;
}
