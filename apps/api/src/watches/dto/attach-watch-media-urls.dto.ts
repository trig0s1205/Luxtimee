import { IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class AttachWatchMediaUrlsDto {
  @IsOptional()
  @ValidateIf((o) => o.primaryImageUrl !== undefined && o.primaryImageUrl !== '')
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] }, { message: 'URL de foto principal inválida' })
  primaryImageUrl?: string;

  @IsOptional()
  @ValidateIf((o) => o.secondaryImageUrl !== undefined && o.secondaryImageUrl !== '')
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] }, { message: 'URL de foto secundaria inválida' })
  secondaryImageUrl?: string;

  @IsOptional()
  @ValidateIf((o) => o.videoUrl !== undefined && o.videoUrl !== '')
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] }, { message: 'URL de video inválida' })
  videoUrl?: string;
}
