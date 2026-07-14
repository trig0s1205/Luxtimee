import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateWarrantyTemplateDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsInt()
  @Min(1)
  durationMonths!: number;

  @IsString()
  @MinLength(10)
  terms!: string;
}

export class UpdateWarrantyTemplateDto {
  @IsString()
  @MinLength(2)
  name?: string;

  @IsInt()
  @Min(1)
  durationMonths?: number;

  @IsString()
  @MinLength(10)
  terms?: string;
}
