import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { Public, Roles, Audit, Financial } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';

@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Public()
  @Get('legal/public')
  getLegalPublic() {
    return this.settingsService.getLegalDocuments();
  }

  @Public()
  @Get('whatsapp/public')
  getWhatsappPublic() {
    return this.settingsService.getWhatsappLink();
  }

  @Get('whatsapp')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  getWhatsapp() {
    return this.settingsService.getWhatsappLink();
  }

  @Patch('whatsapp')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'Setting')
  setWhatsapp(@Body() body: { url: string; messagePrefix: string }) {
    return this.settingsService.setWhatsappLink(body);
  }

  @Get('profit')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard, FinancialGuard)
  @Financial()
  getProfit() {
    return this.settingsService.getProfitConfig();
  }

  @Patch('profit')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard, FinancialGuard)
  @Financial()
  @Audit('UPDATE', 'Setting')
  setProfit(@Body() body: { defaultProfitPercent: number }) {
    return this.settingsService.setProfitConfig(body);
  }

  @Get('commission')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard, FinancialGuard)
  @Financial()
  getCommission() {
    return this.settingsService.getCommissionConfig();
  }

  @Patch('commission')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard, FinancialGuard)
  @Financial()
  @Audit('UPDATE', 'Setting')
  setCommission(@Body() body: { percent: number }) {
    return this.settingsService.setCommissionConfig(body);
  }
}
