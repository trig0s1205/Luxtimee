import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';
import { MAX_PACKAGING_CAPTION, MAX_PACKAGING_PHOTOS } from '@luxtime/shared';
import { sanitizePlainText } from '../../common/utils/sanitize-text.util';

export class UpdatePackagingCaptionDto {
  @IsString()
  @MaxLength(MAX_PACKAGING_CAPTION)
  @Transform(({ value }) => sanitizePlainText(value, MAX_PACKAGING_CAPTION))
  caption!: string;
}

export class ReorderPackagingPhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PACKAGING_PHOTOS)
  @ArrayUnique()
  @IsString({ each: true })
  ids!: string[];
}
