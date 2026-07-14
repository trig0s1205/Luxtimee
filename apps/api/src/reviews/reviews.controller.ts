import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ReviewStatus, Role } from '@prisma/client';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ReviewsService } from './reviews.service';
import { Public, Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateReviewDto {
  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  watchId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  body!: string;
}

@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Public()
  @Get('published')
  published() {
    return this.reviewsService.listPublished();
  }

  @Public()
  @Post()
  create(@Body() dto: CreateReviewDto) {
    return this.reviewsService.createPublic(dto);
  }

  @Get('pending')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  pending() {
    return this.reviewsService.listPending();
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('MODERATE', 'Review')
  moderate(@Param('id') id: string, @Body('status') status: ReviewStatus) {
    return this.reviewsService.moderate(id, status);
  }
}
