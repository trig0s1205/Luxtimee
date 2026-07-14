import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { WarrantiesService } from './warranties.service';
import { CreateWarrantyTemplateDto, UpdateWarrantyTemplateDto } from './dto/warranty.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller({ path: 'warranties', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class WarrantiesController {
  constructor(private warrantiesService: WarrantiesService) {}

  @Get()
  findAll() {
    return this.warrantiesService.findAll();
  }

  @Post()
  @Audit('CREATE', 'WarrantyTemplate')
  create(@Body() dto: CreateWarrantyTemplateDto) {
    return this.warrantiesService.create(dto);
  }

  @Patch(':id')
  @Audit('UPDATE', 'WarrantyTemplate')
  update(@Param('id') id: string, @Body() dto: UpdateWarrantyTemplateDto) {
    return this.warrantiesService.update(id, dto);
  }

  @Delete(':id')
  @Audit('DELETE', 'WarrantyTemplate')
  remove(@Param('id') id: string) {
    return this.warrantiesService.remove(id);
  }
}
