import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ShippingService } from './shipping.service';
import { Public, Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateShippingZoneBodyDto,
  UpdateShippingZoneBodyDto,
} from './dto/shipping-zone.dto';

@Controller({ path: 'shipping-zones', version: '1' })
export class ShippingController {
  constructor(private shippingService: ShippingService) {}

  @Public()
  @Get('public')
  findPublic() {
    return this.shippingService.findAllPublic();
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  findAll() {
    return this.shippingService.findAll();
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('CREATE', 'ShippingZone')
  create(@Body() body: CreateShippingZoneBodyDto) {
    return this.shippingService.create(body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'ShippingZone')
  update(@Param('id') id: string, @Body() body: UpdateShippingZoneBodyDto) {
    return this.shippingService.update(id, body.cost);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('DELETE', 'ShippingZone')
  remove(@Param('id') id: string) {
    return this.shippingService.remove(id);
  }
}
