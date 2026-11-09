import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Audit, Roles } from '../common/decorators/metadata.decorators';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateWarrantyClaimDto,
  UpdateWarrantyClaimNotesDto,
  UpdateWarrantyClaimStatusDto,
  WarrantyClaimsQueryDto,
} from './dto/warranty-claim.dto';
import { WarrantyClaimsService } from './warranty-claims.service';

@Controller({ path: 'warranty-claims', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.VENDEDOR_LOCAL)
@UseGuards(RolesGuard)
export class WarrantyClaimsController {
  constructor(private readonly claims: WarrantyClaimsService) {}

  @Get()
  findAll(@Query() query: WarrantyClaimsQueryDto) {
    return this.claims.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.claims.findById(id);
  }

  @Post()
  @Audit('CREATE', 'WarrantyClaim')
  create(
    @Body() dto: CreateWarrantyClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claims.create(dto, user.id);
  }

  @Patch(':id/status')
  @Audit('UPDATE', 'WarrantyClaim')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWarrantyClaimStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.claims.updateStatus(id, dto, user.id);
  }

  @Patch(':id/notes')
  @Audit('UPDATE', 'WarrantyClaim')
  updateNotes(
    @Param('id') id: string,
    @Body() dto: UpdateWarrantyClaimNotesDto,
  ) {
    return this.claims.updateNotes(id, dto);
  }
}
