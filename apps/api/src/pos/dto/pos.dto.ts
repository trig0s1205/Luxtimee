import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const POS_SORT = ['newest', 'price_asc', 'price_desc', 'brand_asc'] as const;
const PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'DATAFONO_BOLD'] as const;
const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

export class PosCatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dialColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  strapMaterial?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsIn(POS_SORT)
  sort?: (typeof POS_SORT)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  @Type(() => Number)
  limit?: number;
}

export class PosWatchesSearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  search!: string;
}

export class PosCustomersQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  q!: string;
}

export class PosMySalesQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_YMD)
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sellerId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class PosCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  document?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9+\s]*$/)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;
}

export class PosSaleItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  watchId!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  quantity!: number;
}

export class PosPaymentDto {
  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @IsInt()
  @Min(1)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cashReceived?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  approvalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  cardLast4?: string;
}

export class CreatePosSaleDto {
  @ValidateNested()
  @Type(() => PosCustomerDto)
  customer!: PosCustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items!: PosSaleItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => PosPaymentDto)
  payments!: PosPaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CashClosingPreviewQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_YMD)
  date?: string;
}

export class CreateCashClosingDto {
  @IsString()
  @Matches(DATE_YMD)
  date!: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  openingCash!: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  countedCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CashClosingsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_YMD)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_YMD)
  to?: string;
}
