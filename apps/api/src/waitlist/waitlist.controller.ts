import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { WaitlistService } from './waitlist.service';
import { Public } from '../common/decorators/metadata.decorators';

class WaitlistDto {
  @IsEmail()
  email!: string;

  @IsString()
  watchId!: string;
}

@Controller({ path: 'waitlist', version: '1' })
export class WaitlistController {
  constructor(private waitlistService: WaitlistService) {}

  @Public()
  @Post()
  subscribe(@Body() dto: WaitlistDto) {
    return this.waitlistService.subscribe(dto.email, dto.watchId);
  }
}
