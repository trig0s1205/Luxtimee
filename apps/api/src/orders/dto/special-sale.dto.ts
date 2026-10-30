import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { sanitizePlainText } from '../../common/utils/sanitize-text.util';

export class CreateSpecialSaleDto {
  @IsString()
  @IsNotEmpty({ message: 'El reloj es obligatorio' })
  watchId!: string;

  @IsDefined({ message: 'El precio de venta es obligatorio' })
  @Type(() => Number)
  @IsInt({ message: 'El precio de venta debe ser mayor a 0' })
  @Min(1, { message: 'El precio de venta debe ser mayor a 0' })
  @Max(1_000_000_000, { message: 'El precio de venta debe ser mayor a 0' })
  salePrice!: number;

  @IsString()
  @Transform(({ value }) => sanitizePlainText(value, 500))
  @IsNotEmpty({ message: 'La nota es obligatoria' })
  @MinLength(1, { message: 'La nota es obligatoria' })
  @MaxLength(500)
  note!: string;
}

export class SpecialSalesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().slice(0, 100) : value,
  )
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
