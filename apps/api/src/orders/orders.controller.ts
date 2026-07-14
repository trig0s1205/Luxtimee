import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { TransitionOrderDto } from '../pre-orders/dto/pre-order.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller({ path: 'orders', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  findAll() {
    return this.ordersService.findAllOrders();
  }

  @Patch(':id/status')
  @Audit('TRANSITION', 'Order')
  transition(@Param('id') id: string, @Body() dto: TransitionOrderDto) {
    return this.ordersService.transitionStatus(id, dto.status as OrderStatus);
  }
}
