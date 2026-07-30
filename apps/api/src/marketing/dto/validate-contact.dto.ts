import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateMarketingContactBodyDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  approve?: boolean;
}
