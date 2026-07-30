import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/metadata.decorators';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Public()
  @SkipThrottle()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'luxtime-api',
      timestamp: new Date().toISOString(),
    };
  }
}
