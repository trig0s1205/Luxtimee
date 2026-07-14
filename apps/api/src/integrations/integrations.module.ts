import { Module } from '@nestjs/common';
import { ImageProcessingService } from './image-processing.service';
import { WhatsappService } from './whatsapp.service';
import { Ga4Service } from './ga4.service';
import { ReportsService } from './reports.service';

@Module({
  providers: [ImageProcessingService, WhatsappService, Ga4Service, ReportsService],
  exports: [ImageProcessingService, WhatsappService, Ga4Service, ReportsService],
})
export class IntegrationsModule {}
