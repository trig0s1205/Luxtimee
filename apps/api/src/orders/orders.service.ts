import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStage, OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertValidTransition } from './state-machine';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private mapOrder(order: Prisma.OrderGetPayload<{ include: { items: true } }>) {
    return {
      ...order,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      canceledAt: order.canceledAt?.toISOString() ?? null,
    };
  }

  async findAllOrders() {
    const orders = await this.prisma.order.findMany({
      where: { stage: OrderStage.ORDER },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
    });
    return orders.map((o) => this.mapOrder(o));
  }

  async transitionStatus(id: string, next: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order || order.stage !== OrderStage.ORDER || !order.status) {
      throw new NotFoundException('Pedido no encontrado');
    }
    assertValidTransition(order.status, next);

    const data: Prisma.OrderUpdateInput = { status: next };
    if (next === OrderStatus.PAGADO) {
      data.paidAt = new Date();
      await this.deductInventory(order.items);
    }
    if (next === OrderStatus.ENVIADO) data.shippedAt = new Date();
    if (next === OrderStatus.ENTREGADO) data.deliveredAt = new Date();
    if (next === OrderStatus.CANCELADO) data.canceledAt = new Date();

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: { items: true },
    });

    await this.notificationsService.emit({
      type: 'ORDER_STATUS_CHANGED',
      targetRole: Role.ADMIN,
      payload: { orderId: id, status: next, readableId: order.readableId },
    });

    return this.mapOrder(updated);
  }

  private async deductInventory(items: { watchId: string; quantity: number }[]) {
    for (const item of items) {
      await this.prisma.watch.update({
        where: { id: item.watchId },
        data: { stock: { decrement: item.quantity } },
      });
    }
  }
}
