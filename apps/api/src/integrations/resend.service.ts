import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);

  constructor(private config: ConfigService) {}

  async send(input: { to: string; subject: string; html: string }) {
    if (this.config.get('USE_MOCKS') === 'true' || !this.config.get('RESEND_API_KEY')) {
      this.logger.debug(`[resend-mock] to=${input.to} subject=${input.subject}`);
      return { id: 'mock', mock: true };
    }
    return { id: null, mock: false, reason: 'RESEND_API_KEY no configurado' };
  }
}
