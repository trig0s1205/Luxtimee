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
import type { ReportOwnerDto } from '@luxtime/shared';
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

@Controller({ path: 'warranty-histories', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class WarrantyHistoriesController {
  constructor(
    private warrantyHistoriesService: WarrantyHistoriesService,
    private reportsService: ReportsService,
  ) {}

  @Get('export/excel')
  async exportExcel(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const data = await this.warrantyHistoriesService.findForExport('day');
    if (!data.items.length) {
      throw new BadRequestException('No hay garantías registradas hoy para exportar.');
    }
    const buffer = await this.reportsService.buildWarrantyExcel(data, this.toReportOwner(user));
    await this.warrantyHistoriesService.purgeTodayRegistered();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="LUXTIMEE-garantias-hoy.xlsx"');
    res.send(buffer);
  }

  @Get('export/pdf')
  async exportPdf(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const data = await this.warrantyHistoriesService.findForExport('day');
    if (!data.items.length) {
      throw new BadRequestException('No hay garantías registradas hoy para exportar.');
    }
    const buffer = await this.reportsService.buildWarrantyPdf(data, this.toReportOwner(user));
    await this.warrantyHistoriesService.purgeTodayRegistered();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="LUXTIMEE-garantias-hoy.pdf"');
    res.send(buffer);
  }

  @Get()
  findAll(@Query() query: WarrantyHistoriesQueryDto) {
    return this.warrantyHistoriesService.findAll({
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

  private toReportOwner(user: AuthenticatedUser): ReportOwnerDto {
    return {
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
    };
  }
}
