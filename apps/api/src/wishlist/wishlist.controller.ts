import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsString } from 'class-validator';
import { WishlistService } from './wishlist.service';
import { Roles } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class WishlistItemDto {
  @IsString()
  watchId!: string;
}

@Controller({ path: 'wishlist', version: '1' })
@Roles(Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.wishlistService.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: { id: string }, @Body() dto: WishlistItemDto) {
    return this.wishlistService.add(user.id, dto.watchId);
  }

  @Delete(':watchId')
  remove(@CurrentUser() user: { id: string }, @Param('watchId') watchId: string) {
    return this.wishlistService.remove(user.id, watchId);
  }
}
