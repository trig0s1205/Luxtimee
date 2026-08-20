import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { sanitizePlainTextOptional } from '../../common/utils/sanitize-text.util';

export class CreateShippingZoneBodyDto {
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainTextOptional(value, 120) ?? '')
  name!: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  cost!: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isNational?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isManualCost?: boolean;
}

export class UpdateShippingZoneBodyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cost?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isManualCost?: boolean;
}
