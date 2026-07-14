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
import { CareService } from './care.service';
import { CreateCareTemplateDto, UpdateCareTemplateDto } from './dto/care.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';

@Controller({ path: 'care', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class CareController {
  constructor(private careService: CareService) {}

  @Get()
  findAll() {
    return this.careService.findAll();
  }

  @Post()
  @UseInterceptors(AuditInterceptor)
  @Audit('CREATE', 'CareTemplate')
  create(@Body() dto: CreateCareTemplateDto) {
    return this.careService.create(dto);
  }

  @Patch(':id')
  @UseInterceptors(AuditInterceptor)
  @Audit('UPDATE', 'CareTemplate')
  update(@Param('id') id: string, @Body() dto: UpdateCareTemplateDto) {
    return this.careService.update(id, dto);
  }

  @Delete(':id')
  @UseInterceptors(AuditInterceptor)
  @Audit('DELETE', 'CareTemplate')
  remove(@Param('id') id: string) {
    return this.careService.remove(id);
  }
}
