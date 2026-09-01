import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { WatchesModule } from '../watches/watches.module';

@Module({
  imports: [IntegrationsModule, WatchesModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
