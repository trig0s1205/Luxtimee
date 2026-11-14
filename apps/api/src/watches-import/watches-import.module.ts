import { Module } from '@nestjs/common';
import { WatchesModule } from '../watches/watches.module';
import { WatchesImportController } from './watches-import.controller';
import { WatchesImportService } from './watches-import.service';

@Module({
  imports: [WatchesModule],
  controllers: [WatchesImportController],
  providers: [WatchesImportService],
})
export class WatchesImportModule {}
