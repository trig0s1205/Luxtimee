import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export const MAX_BULK_DELETE_WATCHES = 500;

export class BulkDeleteWatchesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_DELETE_WATCHES)
  @IsString({ each: true })
  ids!: string[];
}
