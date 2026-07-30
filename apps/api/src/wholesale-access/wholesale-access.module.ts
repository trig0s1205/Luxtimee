import { Module } from '@nestjs/common';
import { WholesaleAccessController } from './wholesale-access.controller';
import { WholesaleAccessService } from './wholesale-access.service';

@Module({
  controllers: [WholesaleAccessController],
  providers: [WholesaleAccessService],
  exports: [WholesaleAccessService],
})
export class WholesaleAccessModule {}
