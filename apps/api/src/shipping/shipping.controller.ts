import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ShippingService } from './shipping.service';
import { Public, Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';

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

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'ShippingZone')
  update(@Param('id') id: string, @Body('cost') cost: number) {
    return this.shippingService.update(id, cost);
  }
}
