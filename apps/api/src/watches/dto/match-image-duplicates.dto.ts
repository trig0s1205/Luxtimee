import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ImageFingerprintQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  id!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  contentHash!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{16}$/i)
  perceptualHash?: string;
}

export class MatchImageDuplicatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImageFingerprintQueryDto)
  items!: ImageFingerprintQueryDto[];
}
