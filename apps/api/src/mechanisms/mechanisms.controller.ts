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
import { MechanismsService } from './mechanisms.service';
import { CreateMechanismDto, UpdateMechanismDto } from './dto/mechanism.dto';
import { CACHE_TAGS, Cacheable } from '../common/cache/cache.decorator';
import { Public, Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller({ path: 'mechanisms', version: '1' })
export class MechanismsController {
  constructor(private mechanismsService: MechanismsService) {}

  @Public()
  @Get('public')
  @Cacheable({ ttlMs: 600_000, tag: CACHE_TAGS.mechanisms, maxAge: 300 })
  findAllPublic() {
    return this.mechanismsService.findAllPublic();
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  findAll() {
    return this.mechanismsService.findAll();
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('CREATE', 'Mechanism')
  create(@Body() dto: CreateMechanismDto) {
    return this.mechanismsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'Mechanism')
  update(@Param('id') id: string, @Body() dto: UpdateMechanismDto) {
    return this.mechanismsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('DELETE', 'Mechanism')
  remove(@Param('id') id: string) {
    return this.mechanismsService.remove(id);
  }
}
