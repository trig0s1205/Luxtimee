import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SegmentationService } from './segmentation.service';
import { Roles } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller({ path: 'segmentation', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class SegmentationController {
  constructor(private segmentationService: SegmentationService) {}

  @Get('customers')
  customers() {
    return this.segmentationService.listCustomers();
  }

  @Post('customers/:id/suggest')
  suggest(@Param('id') id: string) {
    return this.segmentationService.suggestForUser(id);
  }
}
