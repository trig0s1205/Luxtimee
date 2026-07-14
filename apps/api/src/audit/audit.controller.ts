import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { Roles, Financial } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';

@Controller({ path: 'audit', version: '1' })
@Roles(Role.SUPER_ADMIN)
@UseGuards(RolesGuard, FinancialGuard)
@Financial()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  logs(@Query('limit') limit?: string) {
    return this.auditService.findAll(Number(limit) || 100);
  }
}
