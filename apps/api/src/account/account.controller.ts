import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { AccountService } from './account.service';
import { Roles } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class SavedShippingDto {
  @IsString()
  @MinLength(5)
  address!: string;

  @IsString()
  @MinLength(7)
  phone!: string;
}

@Controller({ path: 'account', version: '1' })
@Roles(Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class AccountController {
  constructor(private accountService: AccountService) {}

  @Get('orders')
  myOrders(@CurrentUser() user: { id: string }) {
    return this.accountService.listMyOrders(user.id);
  }

  @Get('orders/:id/receipt')
  receipt(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.accountService.getReceipt(user.id, id);
  }

  @Get('warranties')
  warranties(@CurrentUser() user: { id: string }) {
    return this.accountService.listWarranties(user.id);
  }

  @Get('shipping')
  shipping(@CurrentUser() user: { id: string }) {
    return this.accountService.getSavedShipping(user.id);
  }

  @Put('shipping')
  saveShipping(@CurrentUser() user: { id: string }, @Body() dto: SavedShippingDto) {
    return this.accountService.upsertSavedShipping(user.id, dto);
  }
}
