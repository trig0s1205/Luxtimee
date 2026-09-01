import { Module } from '@nestjs/common';
import { WatchesController } from './watches.controller';
import { WatchesService } from './watches.service';
import { WatchesRepository } from './watches.repository';
import { SettingsModule } from '../settings/settings.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [SettingsModule, IntegrationsModule],
  controllers: [WatchesController],
  providers: [WatchesService, WatchesRepository],
  exports: [WatchesService, WatchesRepository],
})
export class WatchesModule {}
