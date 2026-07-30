import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { WholesaleAccessModule } from '../wholesale-access/wholesale-access.module';
import { WholesaleAccessGuard } from '../common/guards/wholesale-access.guard';

@Module({
  imports: [WholesaleAccessModule],
  controllers: [CatalogController],
  providers: [CatalogService, WholesaleAccessGuard],
  exports: [CatalogService],
})
export class CatalogModule {}
