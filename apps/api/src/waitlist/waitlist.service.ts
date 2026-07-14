import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResendService } from '../integrations/resend.service';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private prisma: PrismaService,
    private resend: ResendService,
  ) {}

  async subscribe(email: string, watchId: string) {
    return this.prisma.waitlistEntry.upsert({
      where: { email_watchId: { email, watchId } },
      update: { notified: false },
      create: { email, watchId },
    });
  }

  async notifyBackInStock(watchId: string) {
    const entries = await this.prisma.waitlistEntry.findMany({
      where: { watchId, notified: false },
      include: { watch: { include: { brand: true } } },
    });
    for (const entry of entries) {
      await this.resend.send({
        to: entry.email,
        subject: `${entry.watch.brand.name} ${entry.watch.model} vuelve a stock — Luxtime`,
        html: `<p>El modelo que esperabas ya está disponible en Luxtime.</p>`,
      });
      await this.prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { notified: true },
      });
    }
    this.logger.log(`Waitlist notificada para watch ${watchId}: ${entries.length} correos`);
  }
}
