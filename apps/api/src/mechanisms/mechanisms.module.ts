import { Module } from '@nestjs/common';
import { MechanismsService } from './mechanisms.service';
import { MechanismsController } from './mechanisms.controller';

@Module({
  controllers: [MechanismsController],
  providers: [MechanismsService],
  exports: [MechanismsService],
})
export class MechanismsModule {}
