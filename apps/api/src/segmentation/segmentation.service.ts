import { Injectable } from '@nestjs/common';
import { CustomerSegment, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SegmentationService {
  constructor(private prisma: PrismaService) {}

  async suggestForUser(userId: string) {
    const orders = await this.prisma.order.count({
      where: {
        userId,
        status: { in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO] },
      },
    });
    const total = await this.prisma.order.aggregate({
      where: { userId, status: { in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO] } },
      _sum: { total: true },
    });
    const spent = total._sum.total ?? 0;
    let segment: CustomerSegment = CustomerSegment.NUEVO;
    if (orders >= 3) segment = CustomerSegment.RECURRENTE;
    if (spent >= 50000000) segment = CustomerSegment.ALTO_VALOR;
    await this.prisma.user.update({ where: { id: userId }, data: { segment } });
    return segment;
  }

  listCustomers() {
    return this.prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: { id: true, name: true, email: true, segment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
