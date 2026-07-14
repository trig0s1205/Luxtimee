import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MarketingService } from './marketing.service';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller({ path: 'marketing', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class MarketingController {
  constructor(private marketingService: MarketingService) {}

  @Get('contacts/pending')
  pending() {
    return this.marketingService.listPending();
  }

  @Patch('contacts/:id/validate')
  @Audit('VALIDATE_CONTACT', 'MarketingContact')
  validate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body('approve') approve: boolean,
  ) {
    return this.marketingService.validateContact(id, user.id, approve !== false);
  }
}
