import { Module } from '@nestjs/common';
import { PreOrderRemindersService } from './pre-order-reminders.service';
import { CronController } from './cron.controller';
import { NotificationsModule } from '../../notifications/notifications.module';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { PreOrdersModule } from '../../pre-orders/pre-orders.module';

@Module({
  imports: [NotificationsModule, IntegrationsModule, PreOrdersModule],
  controllers: [CronController],
  providers: [PreOrderRemindersService],
})
export class ScheduleTasksModule {}
