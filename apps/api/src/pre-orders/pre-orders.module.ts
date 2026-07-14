import { Module } from '@nestjs/common';
import { PreOrdersService } from './pre-orders.service';
import { PreOrdersController } from './pre-orders.controller';
import { MarketingModule } from '../marketing/marketing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [MarketingModule, NotificationsModule, SettingsModule, IntegrationsModule],
  controllers: [PreOrdersController],
  providers: [PreOrdersService],
  exports: [PreOrdersService],
})
export class PreOrdersModule {}
