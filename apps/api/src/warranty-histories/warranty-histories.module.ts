import { Module } from '@nestjs/common';
import { WarrantyHistoriesService } from './warranty-histories.service';
import { WarrantyHistoriesController } from './warranty-histories.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  controllers: [WarrantyHistoriesController],
  providers: [WarrantyHistoriesService],
  exports: [WarrantyHistoriesService],
})
export class WarrantyHistoriesModule {}
