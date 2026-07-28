import { Injectable } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';
import { toUpperText } from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  createPublic(dto: { customerName: string; watchId?: string; rating: number; body: string }) {
    return this.prisma.review.create({
      data: {
        customerName: toUpperText(dto.customerName),
        watchId: dto.watchId,
        rating: dto.rating,
        body: toUpperText(dto.body),
        status: ReviewStatus.PENDING,
      },
    });
  }

  listPublished(limit = 10) {
    return this.prisma.review.findMany({
      where: { status: ReviewStatus.PUBLISHED },
      include: { watch: { include: { brand: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  listPending() {
    return this.prisma.review.findMany({
      where: { status: ReviewStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  moderate(id: string, status: ReviewStatus) {
    return this.prisma.review.update({ where: { id }, data: { status } });
  }
}
