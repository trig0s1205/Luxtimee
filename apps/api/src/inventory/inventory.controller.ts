import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { UpdateStockDto } from '../products/dto/watch.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller({ path: 'inventory', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Patch(':id/stock')
  @Audit('UPDATE_STOCK', 'Watch')
  updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.inventoryService.updateStock(id, dto);
  }
}
