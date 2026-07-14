import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { DashboardsService } from './dashboards.service';
import { ReportsService } from '../integrations/reports.service';
import { Roles, Financial } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';

@Controller({ path: 'dashboards', version: '1' })
@Roles(Role.SUPER_ADMIN)
@UseGuards(RolesGuard, FinancialGuard)
@Financial()
export class DashboardsController {
  constructor(
    private dashboardsService: DashboardsService,
    private reportsService: ReportsService,
  ) {}

  @Get('profit')
  profit(@Query('period') period?: 'day' | 'week' | 'month' | 'all') {
    return this.dashboardsService.getProfitDashboard(period ?? 'month');
  }

  @Get('health')
  health() {
    return this.dashboardsService.getHealthDashboard();
  }

  @Get('profit/export/excel')
  async exportExcel(@Query('period') period: 'day' | 'week' | 'month' | 'all' = 'month', @Res() res: Response) {
    const data = await this.dashboardsService.getProfitDashboard(period);
    const buffer = await this.reportsService.buildProfitExcel(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="luxtime-ganancia-${period}.xlsx"`);
    res.send(buffer);
  }

  @Get('profit/export/pdf')
  async exportPdf(@Query('period') period: 'day' | 'week' | 'month' | 'all' = 'month', @Res() res: Response) {
    const data = await this.dashboardsService.getProfitDashboard(period);
    const buffer = await this.reportsService.buildProfitPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="luxtime-ganancia-${period}.pdf"`);
    res.send(buffer);
  }
}
