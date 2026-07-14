import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/metadata.decorators';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'luxtime-api',
      timestamp: new Date().toISOString(),
    };
  }
}
