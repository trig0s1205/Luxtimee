import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { WholesaleAccessService } from './wholesale-access.service';
import {
  ActivateWholesaleSessionDto,
  CreateWholesaleAccessBodyDto,
  UpdateWholesaleAccessBodyDto,
} from './dto/wholesale-access.dto';
import { Public, Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WHOLESALE_ACCESS_COOKIE } from '@luxtime/shared';
import { Throttle } from '@nestjs/throttler';

@Controller({ path: 'wholesale-access', version: '1' })
export class WholesaleAccessController {
  constructor(private wholesaleAccessService: WholesaleAccessService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('session')
  activate(
    @Body() dto: ActivateWholesaleSessionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.wholesaleAccessService.activateSession(dto.token, res);
  }

  @Public()
  @Get('session')
  session(@Req() req: Request) {
    const token = req.cookies?.[WHOLESALE_ACCESS_COOKIE] as string | undefined;
    return this.wholesaleAccessService.getSessionFromToken(token);
  }

  @Public()
  @Post('session/logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.wholesaleAccessService.clearSession(res);
    return { ok: true };
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  list() {
    return this.wholesaleAccessService.list();
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('CREATE', 'WholesaleAccess')
  create(
    @Body() dto: CreateWholesaleAccessBodyDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.wholesaleAccessService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'WholesaleAccess')
  update(@Param('id') id: string, @Body() dto: UpdateWholesaleAccessBodyDto) {
    return this.wholesaleAccessService.update(id, dto);
  }

  @Post(':id/revoke')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('REVOKE', 'WholesaleAccess')
  revoke(@Param('id') id: string) {
    return this.wholesaleAccessService.revoke(id);
  }

  @Post(':id/regenerate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('REGENERATE', 'WholesaleAccess')
  regenerate(@Param('id') id: string) {
    return this.wholesaleAccessService.regenerateToken(id);
  }
}
