import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStage, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  private mapOrder(order: {
    items: unknown[];
    createdAt: Date;
    updatedAt: Date;
    paidAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    canceledAt: Date | null;
    [key: string]: unknown;
  }) {
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

  private getOrderWithItems(id: string, userId: string) {
    return this.prisma.order.findFirst({
      where: { id, userId },
      include: { items: true, shippingZone: true },
    });
  }

  async listMyOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId, stage: OrderStage.ORDER },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => this.mapOrder(o));
  }

  async getReceipt(userId: string, orderId: string) {
    const order = await this.getOrderWithItems(orderId, userId);
    if (!order || order.stage !== OrderStage.ORDER) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return {
      readableId: order.readableId,
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      customerEmail: order.customerEmail,
      type: order.type,
      status: order.status,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      shippingZone: order.shippingZone?.name ?? null,
      total: order.total,
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.unitPrice * i.quantity,
      })),
    };
  }

  async listWarranties(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO] },
        paidAt: { not: null },
      },
      include: {
        items: {
          include: {
            watch: { include: { warrantyTemplate: true, brand: true } },
          },
        },
      },
    });

    const now = Date.now();
    return orders.flatMap((order) =>
      order.items.flatMap((item) => {
        const template = item.watch.warrantyTemplate;
        if (!template || !order.paidAt) return [];
        const endsAt = new Date(order.paidAt);
        endsAt.setMonth(endsAt.getMonth() + template.durationMonths);
        const remainingMs = endsAt.getTime() - now;
        const remainingDays = Math.max(0, Math.ceil(remainingMs / 86400000));
        return Array.from({ length: item.quantity }, (_, idx) => ({
          orderId: order.id,
          readableId: order.readableId,
          watchId: item.watchId,
          productName: item.productName,
          brand: item.watch.brand.name,
          model: item.watch.model,
          warrantyName: template.name,
          durationMonths: template.durationMonths,
          paidAt: order.paidAt!.toISOString(),
          endsAt: endsAt.toISOString(),
          remainingDays,
          unitIndex: idx + 1,
        }));
      }),
    );
  }

  async getSavedShipping(userId: string) {
    return this.prisma.savedShipping.findUnique({ where: { userId } });
  }

  async upsertSavedShipping(userId: string, data: { address: string; phone: string }) {
    return this.prisma.savedShipping.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }
}
