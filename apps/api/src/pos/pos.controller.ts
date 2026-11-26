import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
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
  CreateCashOutDto,
  CreatePosSaleDto,
  PosCatalogQueryDto,
  PosCustomersQueryDto,
  PosMySalesQueryDto,
  PosWatchesSearchDto,
  VoidPosSaleDto,
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

  @Get('sales/by-idempotency/:key')
  saleByIdempotency(@Param('key') key: string) {
    return this.posService.findSaleByIdempotencyKey(key);
  }

  @Post('sales/:id/void')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.VENDEDOR_LOCAL)
  @Audit('VOID', 'Order')
  voidSale(
    @Param('id') id: string,
    @Body() dto: VoidPosSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.voidSale(id, dto.reason, user);
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
  @UseGuards(RolesGuard)
  myCashClosings(
    @Query() query: CashClosingsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.myCashClosings(user.id, query.page, query.limit);
  }

  @Get('cash-closings')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  listCashClosings(@Query() query: CashClosingsQueryDto) {
    return this.posService.listCashClosings(
      query.from,
      query.to,
      query.page,
      query.limit,
    );
  }

  @Post('cash-outs')
  @UseGuards(RolesGuard)
  @Audit('CREATE', 'Expense')
  createCashOut(
    @Body() dto: CreateCashOutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.posService.createCashOut(dto, user);
  }

  @Get('cash-closings/:id/pdf')
  @UseGuards(RolesGuard)
  async cashClosingPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.posService.cashClosingPdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
