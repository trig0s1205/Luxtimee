import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { LabelsLookupDto, LabelsPdfDto } from './dto/labels.dto';
import { LabelsService } from './labels.service';

@Controller({ path: 'labels', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post('watches/lookup')
  lookup(@Body() body: LabelsLookupDto) {
    return this.labelsService.lookup(body.watchIds);
  }

  @Post('watches/pdf')
  async pdf(@Body() body: LabelsPdfDto, @Res() res: Response) {
    const { filename, buffer } = await this.labelsService.buildPdf(body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }
}
