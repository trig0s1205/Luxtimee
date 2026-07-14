import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { PreOrdersService } from './pre-orders.service';
import { CreatePreOrderDto, UpdatePreOrderDto } from './dto/pre-order.dto';
import { Public, Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller({ path: 'pre-orders', version: '1' })
export class PreOrdersController {
  constructor(private preOrdersService: PreOrdersService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  create(@Body() dto: CreatePreOrderDto, @CurrentUser() user?: { id: string }) {
    return this.preOrdersService.createPublic(dto, user?.id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  findAll() {
    return this.preOrdersService.findAllPreOrders();
  }

  @Get('count')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  count() {
    return this.preOrdersService.countActivePreOrders();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  findOne(@Param('id') id: string) {
    return this.preOrdersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'PreOrder')
  update(@Param('id') id: string, @Body() dto: UpdatePreOrderDto) {
    return this.preOrdersService.updatePreOrder(id, dto);
  }

  @Post(':id/confirm-deposit')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('CONFIRM_DEPOSIT', 'PreOrder')
  confirmDeposit(@Param('id') id: string) {
    return this.preOrdersService.confirmDeposit(id);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('CANCEL', 'PreOrder')
  cancel(@Param('id') id: string) {
    return this.preOrdersService.cancelPreOrder(id);
  }
}
