import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { WHOLESALE_ACCESS_COOKIE } from '@luxtime/shared';
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
  create(@Body() dto: CreatePreOrderDto, @Req() req: Request, @CurrentUser() user?: { id: string }) {
    const wholesaleToken = req.cookies?.[WHOLESALE_ACCESS_COOKIE] as string | undefined;
    return this.preOrdersService.createPublic(dto, user?.id, wholesaleToken);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  findActive(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.preOrdersService.findActivePreOrders(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Get('suspended')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  findSuspended(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.preOrdersService.findSuspendedPreOrders(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Get('count')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  count() {
    return this.preOrdersService.countPreOrders();
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

  @Post(':id/reactivate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('REACTIVATE', 'PreOrder')
  reactivate(@Param('id') id: string) {
    return this.preOrdersService.reactivatePreOrder(id);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('CANCEL', 'PreOrder')
  cancel(@Param('id') id: string) {
    return this.preOrdersService.cancelPreOrder(id);
  }
}
