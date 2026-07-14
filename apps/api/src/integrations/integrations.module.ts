import { Module } from '@nestjs/common';
import { ImageProcessingService } from './image-processing.service';
import { WhatsappService } from './whatsapp.service';
import { Ga4Service } from './ga4.service';
import { ReportsService } from './reports.service';
import { ResendService } from './resend.service';

@Module({
  providers: [ImageProcessingService, WhatsappService, Ga4Service, ReportsService, ResendService],
  exports: [ImageProcessingService, WhatsappService, Ga4Service, ReportsService, ResendService],
})
export class IntegrationsModule {}
