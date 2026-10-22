import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BulkDraftWatchDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  @Matches(/^[^\u0000-\u001F\u007F]+$/)
  idempotencyKey!: string;
}
