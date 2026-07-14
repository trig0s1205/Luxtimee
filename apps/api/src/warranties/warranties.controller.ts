import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { WarrantiesService } from './warranties.service';
import { CreateWarrantyTemplateDto, UpdateWarrantyTemplateDto } from './dto/warranty.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';

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
  @UseInterceptors(AuditInterceptor)
  @Audit('CREATE', 'WarrantyTemplate')
  create(@Body() dto: CreateWarrantyTemplateDto) {
    return this.warrantiesService.create(dto);
  }

  @Patch(':id')
  @UseInterceptors(AuditInterceptor)
  @Audit('UPDATE', 'WarrantyTemplate')
  update(@Param('id') id: string, @Body() dto: UpdateWarrantyTemplateDto) {
    return this.warrantiesService.update(id, dto);
  }

  @Delete(':id')
  @UseInterceptors(AuditInterceptor)
  @Audit('DELETE', 'WarrantyTemplate')
  remove(@Param('id') id: string) {
    return this.warrantiesService.remove(id);
  }
}
