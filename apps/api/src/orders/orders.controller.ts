import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { TransitionOrderDto } from '../pre-orders/dto/pre-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller({ path: 'orders', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get('sales')
  findSales(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.ordersService.findSales(
      page ? Number(page) : 1,
      limit ? Number(limit) : 25,
    );
  }

  @Get()
  findAll(@Query() query: OrdersQueryDto) {
    return this.ordersService.findAllOrders({
      period: query.period,
      status: query.status,
      type: query.type,
      page: query.page,
      limit: query.limit,
    });
  }

  @Patch(':id/status')
  @Audit('TRANSITION', 'Order')
  transition(@Param('id') id: string, @Body() dto: TransitionOrderDto) {
    return this.ordersService.transitionStatus(id, dto.status as OrderStatus);
  }

  @Patch(':id')
  @Audit('UPDATE', 'Order')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.updateOrder(id, dto);
  }

  @Delete(':id')
  @Audit('DELETE', 'Order')
  remove(@Param('id') id: string) {
    return this.ordersService.deleteOrder(id);
  }
}
