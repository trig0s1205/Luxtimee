import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async emit(input: { type: string; payload: Record<string, unknown>; targetRole?: Role }) {
    return this.prisma.notification.create({
      data: {
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        targetRole: input.targetRole,
      },
    });
  }

  async listForStaff(role: Role) {
    return this.prisma.notification.findMany({
      where: {
        OR: [{ targetRole: role }, { targetRole: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async unreadCount(role: Role) {
    return this.prisma.notification.count({
      where: {
        readAt: null,
        OR: [{ targetRole: role }, { targetRole: null }],
      },
    });
  }
}
