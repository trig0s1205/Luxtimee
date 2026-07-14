import { Controller, Post } from '@nestjs/common';
import { PreOrderRemindersService } from './pre-order-reminders.service';
import { Public } from '../decorators/metadata.decorators';

@Controller({ path: 'internal/cron', version: '1' })
export class CronController {
  constructor(private reminders: PreOrderRemindersService) {}

  @Public()
  @Post('pre-order-reminders')
  runPreOrderReminders() {
    // En producción proteger con token de Cloud Scheduler
    return this.reminders.runManual();
  }
}
