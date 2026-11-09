import { Module } from '@nestjs/common';
import { CacheModule } from '../common/cache/cache.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { PosCatalogService } from './pos-catalog.service';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [
    ReceiptsModule,
    NotificationsModule,
    CacheModule,
    IntegrationsModule,
  ],
  controllers: [PosController],
  providers: [PosService, PosCatalogService],
  exports: [PosService, PosCatalogService],
})
export class PosModule {}
