import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import type { ProfitReportPeriod, ReportOwnerDto } from '@luxtime/shared';
import { DashboardsService } from './dashboards.service';
import { ReportsService } from '../integrations/reports.service';
import { Ga4Service } from '../integrations/ga4.service';
import { Roles, Financial } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

const EXPORT_PERIODS: ProfitReportPeriod[] = ['day', 'week', 'month'];

@Controller({ path: 'dashboards', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard, FinancialGuard)
export class DashboardsController {
  constructor(
    private dashboardsService: DashboardsService,
    private reportsService: ReportsService,
    private ga4Service: Ga4Service,
  ) {}

  @Get('profit')
  @Roles(Role.SUPER_ADMIN)
  @Financial()
  profit(@Query('period') period?: 'day' | 'week' | 'month' | 'all') {
    return this.dashboardsService.getProfitDashboard(period ?? 'month');
  }

  @Get('health')
  health(@Query('period') period?: 'day' | '2weeks' | 'week' | 'month' | '3months' | 'all') {
    return this.dashboardsService.getHealthDashboard(period ?? 'month');
  }

  @Get('analytics/status')
  analyticsStatus() {
    return this.ga4Service.getStatus();
  }

  @Get('analytics')
  analytics() {
    return this.ga4Service.getEngagementMetrics();
  }

  @Get('revenue')
  revenue(@Query('range') range?: 'today' | '1_week' | '1_month' | 'historical') {
    return this.dashboardsService.getRevenueDashboard(range ?? '1_month');
  }

  @Get('profit/export/excel')
  @Roles(Role.SUPER_ADMIN)
  @Financial()
  async exportExcel(
    @Query('period') period: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const safePeriod = this.assertExportPeriod(period);
    const data = await this.dashboardsService.getProfitDashboard(safePeriod);
    const buffer = await this.reportsService.buildProfitExcel(data, this.toReportOwner(user));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="LUXTIMEE-ganancia-${safePeriod}.xlsx"`);
    res.send(buffer);
  }

  @Get('profit/export/pdf')
  @Roles(Role.SUPER_ADMIN)
  @Financial()
  async exportPdf(
    @Query('period') period: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const safePeriod = this.assertExportPeriod(period);
    const data = await this.dashboardsService.getProfitDashboard(safePeriod);
    const buffer = await this.reportsService.buildProfitPdf(data, this.toReportOwner(user));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LUXTIMEE-ganancia-${safePeriod}.pdf"`);
    res.send(buffer);
  }

  private assertExportPeriod(period: string): ProfitReportPeriod {
    if (!EXPORT_PERIODS.includes(period as ProfitReportPeriod)) {
      throw new BadRequestException('Los reportes solo pueden exportarse por día, semana o mes.');
    }
    return period as ProfitReportPeriod;
  }

  private toReportOwner(user: AuthenticatedUser): ReportOwnerDto {
    return {
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
    };
  }
}
