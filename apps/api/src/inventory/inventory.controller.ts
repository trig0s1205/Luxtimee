import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { InventoryService } from './inventory.service';
import { InventoryImportService } from './import.service';
import { UpdateStockDto } from '../products/dto/watch.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller({ path: 'inventory', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(
    private inventoryService: InventoryService,
    private importService: InventoryImportService,
  ) {}

  @Patch(':id/stock')
  @Audit('UPDATE_STOCK', 'Watch')
  updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.inventoryService.updateStock(id, dto);
  }

  @Get('import/template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.importService.buildTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="luxtime-inventario-template.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @Audit('IMPORT', 'Watch')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('Archivo requerido');
    return this.importService.parseAndImport(file.buffer);
  }
}
