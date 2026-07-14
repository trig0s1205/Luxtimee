import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResendService {
  constructor(private config: ConfigService) {}

  async send(input: { to: string; subject: string; html: string }) {
    if (this.config.get('USE_MOCKS') === 'true' || !this.config.get('RESEND_API_KEY')) {
      console.log('[resend-mock]', input.to, input.subject);
      return { id: 'mock', mock: true };
    }
    return { id: null, mock: false, reason: 'RESEND_API_KEY no configurado' };
  }
}
