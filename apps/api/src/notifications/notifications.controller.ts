import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { Roles } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller({ path: 'notifications', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('CDN-Cache-Control', 'no-store')
  list(@CurrentUser() user: { role: Role }) {
    return this.notificationsService.listForStaff(user.role);
  }

  @Get('unread-count')
  @Header('Cache-Control', 'private, no-store')
  @Header('CDN-Cache-Control', 'no-store')
  unread(@CurrentUser() user: { role: Role }) {
    return this.notificationsService.unreadCount(user.role);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: { role: Role }) {
    return this.notificationsService.markAllRead(user.role);
  }

  @Delete('read')
  deleteRead(@CurrentUser() user: { role: Role }) {
    return this.notificationsService.deleteRead(user.role);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Delete(':id')
  deleteOne(@Param('id') id: string, @CurrentUser() user: { role: Role }) {
    return this.notificationsService.deleteOne(id, user.role);
  }
}
