import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class LabelsLookupDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  watchIds!: string[];
}

export class LabelsPdfItemDto {
  @IsString()
  watchId!: string;

  @IsInt()
  @Min(0)
  @Max(500)
  @Type(() => Number)
  quantity!: number;
}

export class LabelsPdfDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LabelsPdfItemDto)
  items!: LabelsPdfItemDto[];

  @IsIn(['SHEET_LETTER_3X10', 'THERMAL_50X25'])
  layout!: 'SHEET_LETTER_3X10' | 'THERMAL_50X25';

  @IsOptional()
  @IsBoolean()
  includePrice?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  startPosition?: number;

  @IsOptional()
  @IsNumber()
  @Min(-5)
  @Max(5)
  @Type(() => Number)
  offsetXmm?: number;

  @IsOptional()
  @IsNumber()
  @Min(-5)
  @Max(5)
  @Type(() => Number)
  offsetYmm?: number;
}
