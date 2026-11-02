import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { TransitionOrderDto } from '../pre-orders/dto/pre-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import {
  CreateSpecialSaleDto,
  SpecialSalesQueryDto,
} from './dto/special-sale.dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

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

  @Get('special-sales')
  findSpecialSales(@Query() query: SpecialSalesQueryDto) {
    return this.ordersService.findSpecialSales(query);
  }

  @Post('special-sales')
  @Audit('CREATE', 'Order')
  createSpecialSale(
    @Body() dto: CreateSpecialSaleDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.ordersService.createSpecialSale(dto, user?.id);
  }

  @Get()
  findAll(@Query() query: OrdersQueryDto) {
    return this.ordersService.findAllOrders({
      period: query.period,
      status: query.status,
      type: query.type,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post(':id/balance-payment')
  @Audit('REGISTER_BALANCE', 'Order')
  registerBalance(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.ordersService.registerBalancePayment(id, user?.id);
  }

  @Patch(':id/status')
  @Audit('TRANSITION', 'Order')
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionOrderDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.ordersService.transitionStatus(id, dto.status as OrderStatus, {
      confirmBalancePaid: dto.confirmBalancePaid,
      registeredById: user?.id,
    });
  }

  @Patch(':id')
  @Audit('UPDATE', 'Order')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.ordersService.updateOrder(id, dto, user?.id);
  }

  @Delete(':id')
  @Audit('DELETE', 'Order')
  remove(@Param('id') id: string) {
    return this.ordersService.deleteOrder(id);
  }
}
