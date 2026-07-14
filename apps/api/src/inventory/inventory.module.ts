import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryImportService } from './import.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryImportService],
  exports: [InventoryService],
})
export class InventoryModule {}
