import { Module } from '@nestjs/common';
import { LabelPdfRenderer } from './label-pdf.renderer';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';

@Module({
  controllers: [LabelsController],
  providers: [LabelsService, LabelPdfRenderer],
  exports: [LabelsService],
})
export class LabelsModule {}
