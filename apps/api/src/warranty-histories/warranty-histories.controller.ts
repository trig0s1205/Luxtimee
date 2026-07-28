import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import type { ReportOwnerDto, WarrantyHistoryPeriod } from '@luxtime/shared';
import { WarrantyHistoriesService } from './warranty-histories.service';
import { ReportsService } from '../integrations/reports.service';
import {
  CreateWarrantyHistoryDto,
  RegisterWarrantyHistoryDto,
  WarrantyHistoriesQueryDto,
} from './dto/warranty-history.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

const EXPORT_PERIODS: WarrantyHistoryPeriod[] = ['day', 'week', 'month'];

@Controller({ path: 'warranty-histories', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class WarrantyHistoriesController {
  constructor(
    private warrantyHistoriesService: WarrantyHistoriesService,
    private reportsService: ReportsService,
  ) {}

  @Get('export/excel')
  async exportExcel(
    @Query('period') period: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const safePeriod = this.assertExportPeriod(period);
    const data = await this.warrantyHistoriesService.findForExport(safePeriod);
    const buffer = await this.reportsService.buildWarrantyExcel(data, this.toReportOwner(user));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="luxtime-garantias-${safePeriod}.xlsx"`);
    res.send(buffer);
  }

  @Get('export/pdf')
  async exportPdf(
    @Query('period') period: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const safePeriod = this.assertExportPeriod(period);
    const data = await this.warrantyHistoriesService.findForExport(safePeriod);
    const buffer = await this.reportsService.buildWarrantyPdf(data, this.toReportOwner(user));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="luxtime-garantias-${safePeriod}.pdf"`);
    res.send(buffer);
  }

  @Get()
  findAll(@Query() query: WarrantyHistoriesQueryDto) {
    return this.warrantyHistoriesService.findAll({
      period: query.period,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post()
  @Audit('CREATE', 'WarrantyHistory')
  create(@Body() dto: CreateWarrantyHistoryDto, @CurrentUser() user: AuthenticatedUser) {
    if (dto.replacementType === 'OTHER_WATCH' && !dto.replacementSku?.trim()) {
      throw new BadRequestException('Indique el SKU del reloj de reemplazo.');
    }
    return this.warrantyHistoriesService.create(dto, user.id);
  }

  @Patch(':id/register')
  @Audit('REGISTER', 'WarrantyHistory')
  register(
    @Param('id') id: string,
    @Body() dto: RegisterWarrantyHistoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (dto.replacementType === 'OTHER_WATCH' && !dto.replacementSku?.trim()) {
      throw new BadRequestException('Indique el SKU del reloj de reemplazo.');
    }
    return this.warrantyHistoriesService.register(id, dto, user.id);
  }

  private assertExportPeriod(period: string): WarrantyHistoryPeriod {
    if (!EXPORT_PERIODS.includes(period as WarrantyHistoryPeriod)) {
      throw new BadRequestException('Los reportes solo pueden exportarse por día, semana o mes.');
    }
    return period as WarrantyHistoryPeriod;
  }

  private toReportOwner(user: AuthenticatedUser): ReportOwnerDto {
    return {
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
    };
  }
}
