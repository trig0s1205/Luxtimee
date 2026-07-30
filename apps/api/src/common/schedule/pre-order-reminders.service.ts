import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStage, Role } from '@prisma/client';
import { PRE_ORDER_RESPONSE_HOURS } from '@luxtime/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WhatsappService } from '../../integrations/whatsapp.service';
import { PreOrdersService } from '../../pre-orders/pre-orders.service';

@Injectable()
export class PreOrderRemindersService {
  private readonly logger = new Logger(PreOrderRemindersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private whatsappService: WhatsappService,
    private preOrdersService: PreOrdersService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleReminders() {
    const suspended = await this.preOrdersService.suspendExpiredPreOrders();
    if (suspended) {
      this.logger.log(`Pre-pedidos suspendidos automáticamente: ${suspended}`);
    }

    const reminderThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const activeThreshold = new Date(Date.now() - PRE_ORDER_RESPONSE_HOURS * 60 * 60 * 1000);
    const preOrders = await this.prisma.order.findMany({
      where: {
        stage: OrderStage.PRE_ORDER,
        canceledAt: null,
        suspendedAt: null,
        depositConfirmed: false,
        preOrderActiveAt: { gte: activeThreshold, lt: reminderThreshold },
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
    }

    if (preOrders.length) {
      this.logger.log(`Recordatorios enviados: ${preOrders.length}`);
    }
  }

  async runManual() {
    await this.handleReminders();
    return { ok: true };
  }
}
