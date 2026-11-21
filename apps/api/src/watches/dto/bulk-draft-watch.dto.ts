import { Allow, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BulkDraftWatchDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  @Matches(/^[^\u0000-\u001F\u007F]+$/)
  idempotencyKey!: string;

  /** Multer a veces deja el archivo en el body; el pipe global no debe rechazarlo. */
  @Allow()
  image1?: unknown;

  @Allow()
  image2?: unknown;
}
