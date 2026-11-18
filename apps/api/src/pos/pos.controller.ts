import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { Audit, Roles } from '../common/decorators/metadata.decorators';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { assertImageBuffer } from '../common/utils/file-magic.util';
import {
  CashClosingPreviewQueryDto,
  CashClosingsQueryDto,
  CreateCashClosingDto,
  CreatePosSaleDto,
  PosCatalogQueryDto,
  PosCustomersQueryDto,
  PosMySalesQueryDto,
  PosWatchesSearchDto,
} from './dto/pos.dto';
import { PosCatalogService } from './pos-catalog.service';
import { PosService } from './pos.service';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

@Controller({ path: 'pos', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.VENDEDOR_LOCAL)
@UseGuards(RolesGuard)
export class PosController {
  constructor(
    private readonly posService: PosService,
    private readonly catalog: PosCatalogService,
  ) {}

  @Get('watches/by-sku/:code')
  findBySku(@Param('code') code: string) {
    return this.catalog.findBySku(code);
  }

  @Get('watches')
  searchWatches(@Query() query: PosWatchesSearchDto) {
    return this.catalog.searchWatches(query.search);
  }

  @Get('catalog')
  listCatalog(@Query() query: PosCatalogQueryDto) {
    return this.catalog.listCatalog(query);
  }

  @Get('catalog/facets')
  facets() {
    return this.catalog.facets();
  }

  @Get('customers')
  customers(
    @Query() query: PosCustomersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.searchCustomers(query.q, user);
  }

  @Post('proof')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PROOF_BYTES },
    }),
  )
  uploadProof(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió el archivo');
    assertImageBuffer(file.buffer, file.mimetype);
    return this.posService.uploadProof(file);
  }

  @Post('sales')
  @Audit('CREATE', 'Order')
  createSale(
    @Body() dto: CreatePosSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.createSale(dto, user);
  }

  @Get('my-sales')
  mySales(
    @Query() query: PosMySalesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.mySales(query, user);
  }

  @Get('cash-closing/preview')
  cashClosingPreview(
    @Query() query: CashClosingPreviewQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.cashClosingPreview(query.date, user);
  }

  @Post('cash-closing')
  @Audit('CREATE', 'CashClosing')
  createCashClosing(
    @Body() dto: CreateCashClosingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.createCashClosing(dto, user);
  }

  @Get('cash-closings/mine')
  myCashClosings(@CurrentUser() user: AuthenticatedUser) {
    return this.posService.myCashClosings(user.id);
  }

  @Get('cash-closings')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  listCashClosings(@Query() query: CashClosingsQueryDto) {
    return this.posService.listCashClosings(query.from, query.to);
  }
}
