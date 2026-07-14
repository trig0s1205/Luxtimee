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
import { CareService } from './care.service';
import { CreateCareTemplateDto, UpdateCareTemplateDto } from './dto/care.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

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
  @Audit('CREATE', 'CareTemplate')
  create(@Body() dto: CreateCareTemplateDto) {
    return this.careService.create(dto);
  }

  @Patch(':id')
  @Audit('UPDATE', 'CareTemplate')
  update(@Param('id') id: string, @Body() dto: UpdateCareTemplateDto) {
    return this.careService.update(id, dto);
  }

  @Delete(':id')
  @Audit('DELETE', 'CareTemplate')
  remove(@Param('id') id: string) {
    return this.careService.remove(id);
  }
}
