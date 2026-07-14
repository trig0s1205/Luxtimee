import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStage, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WhatsappService } from '../../integrations/whatsapp.service';

@Injectable()
export class PreOrderRemindersService {
  private readonly logger = new Logger(PreOrderRemindersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private whatsappService: WhatsappService,
  ) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleReminders() {
    const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const preOrders = await this.prisma.order.findMany({
      where: {
        stage: OrderStage.PRE_ORDER,
        canceledAt: null,
        updatedAt: { lt: threshold },
      },
    });

    for (const order of preOrders) {
      await this.notificationsService.emit({
        type: 'PRE_ORDER_REMINDER',
        targetRole: Role.ADMIN,
        payload: { orderId: order.id, readableId: order.readableId },
      });
      await this.whatsappService.notifyStaff(
        `Recordatorio: pre-pedido ${order.readableId} sin gestionar`,
      );
      await this.prisma.order.update({
        where: { id: order.id },
        data: { updatedAt: new Date() },
      });
    }

    if (preOrders.length) {
      this.logger.log(`Recordatorios enviados: ${preOrders.length}`);
    }
  }

  // Endpoint seguro para Google Cloud Scheduler
  async runManual() {
    await this.handleReminders();
    return { ok: true };
  }
}
