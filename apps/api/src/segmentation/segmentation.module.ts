import { Module } from '@nestjs/common';
import { SegmentationService } from './segmentation.service';
import { SegmentationController } from './segmentation.controller';

@Module({
  controllers: [SegmentationController],
  providers: [SegmentationService],
})
export class SegmentationModule {}
