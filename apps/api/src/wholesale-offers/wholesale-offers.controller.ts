import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { WholesaleOffersService } from './wholesale-offers.service';
import {
  UpdateWholesaleExtraDto,
  UpdateWholesalePackageDto,
  UpsertWholesaleExtraDto,
  UpsertWholesalePackageDto,
} from './dto/wholesale-offers.dto';
import { Audit, Public, Roles } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { WholesaleAccessGuard } from '../common/guards/wholesale-access.guard';

@Controller({ path: 'wholesale-offers', version: '1' })
export class WholesaleOffersController {
  constructor(private offers: WholesaleOffersService) {}

  @Public()
  @UseGuards(WholesaleAccessGuard)
  @Get('catalog')
  catalog() {
    return this.offers.getPublicCatalog();
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  adminList() {
    return this.offers.getAdminState();
  }

  @Post('extras')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('CREATE', 'WholesaleExtra')
  createExtra(@Body() dto: UpsertWholesaleExtraDto) {
    return this.offers.createExtra(dto);
  }

  @Patch('extras/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'WholesaleExtra')
  updateExtra(@Param('id') id: string, @Body() dto: UpdateWholesaleExtraDto) {
    return this.offers.updateExtra(id, dto);
  }

  @Delete('extras/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('DELETE', 'WholesaleExtra')
  deleteExtra(@Param('id') id: string) {
    return this.offers.deleteExtra(id);
  }

  @Post('packages')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('CREATE', 'WholesalePackage')
  createPackage(@Body() dto: UpsertWholesalePackageDto) {
    return this.offers.createPackage(dto);
  }

  @Patch('packages/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'WholesalePackage')
  updatePackage(@Param('id') id: string, @Body() dto: UpdateWholesalePackageDto) {
    return this.offers.updatePackage(id, dto);
  }

  @Delete('packages/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('DELETE', 'WholesalePackage')
  deletePackage(@Param('id') id: string) {
    return this.offers.deletePackage(id);
  }
}
