import {
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PreOrderRemindersService } from './pre-order-reminders.service';
import { Public } from '../decorators/metadata.decorators';
import { timingSafeEqual } from 'crypto';

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Controller({ path: 'internal/cron', version: '1' })
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private reminders: PreOrderRemindersService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post('pre-order-reminders')
  runPreOrderReminders(
    @Headers('x-cron-secret') cronSecretHeader?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const expected = this.config.get<string>('CRON_SECRET')?.trim();
    const isProd = this.config.get('NODE_ENV') === 'production';

    if (!expected) {
      if (isProd) {
        throw new ServiceUnavailableException('CRON_SECRET no configurado');
      }
      this.logger.warn('CRON_SECRET ausente: cron permitido solo en desarrollo');
      return this.reminders.runManual();
    }

    const bearer =
      authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined;
    const provided = (cronSecretHeader ?? bearer ?? '').trim();

    if (!provided || !secretsMatch(provided, expected)) {
      throw new ForbiddenException('Secret de cron inválido');
    }

    return this.reminders.runManual();
  }
}
