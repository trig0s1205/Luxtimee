import { Injectable } from '@nestjs/common';
import { MarketingContactStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketingService {
  constructor(private prisma: PrismaService) {}

  async captureCheckoutEmail(email: string) {
    await this.prisma.marketingContact.upsert({
      where: { email },
      update: { status: MarketingContactStatus.PENDING_VALIDATION, source: 'checkout' },
      create: { email, status: MarketingContactStatus.PENDING_VALIDATION, source: 'checkout' },
    });
  }

  async listPending() {
    return this.prisma.marketingContact.findMany({
      where: { status: MarketingContactStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateContact(id: string, userId: string, approve: boolean) {
    return this.prisma.marketingContact.update({
      where: { id },
      data: {
        status: approve ? MarketingContactStatus.VALIDATED : MarketingContactStatus.REJECTED,
        validatedById: userId,
      },
    });
  }
}
