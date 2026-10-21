import { Module } from '@nestjs/common';
import { WholesaleOffersService } from './wholesale-offers.service';
import { WholesaleOffersController } from './wholesale-offers.controller';
import { WholesaleAccessModule } from '../wholesale-access/wholesale-access.module';

@Module({
  imports: [WholesaleAccessModule],
  controllers: [WholesaleOffersController],
  providers: [WholesaleOffersService],
  exports: [WholesaleOffersService],
})
export class WholesaleOffersModule {}
