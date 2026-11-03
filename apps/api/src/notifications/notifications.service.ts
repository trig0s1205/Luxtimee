import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const STAFF_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

export function notificationAudience(role: Role): Prisma.NotificationWhereInput {
  if (STAFF_ROLES.includes(role)) {
    return {
      OR: [{ targetRole: null }, { targetRole: { in: STAFF_ROLES } }],
    };
  }
  return { OR: [{ targetRole: role }, { targetRole: null }] };
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async emit(input: {
    type: string;
    payload: Record<string, unknown>;
    targetRole?: Role;
  }) {
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
      where: notificationAudience(role),
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

  async markAllRead(role: Role) {
    const result = await this.prisma.notification.updateMany({
      where: {
        readAt: null,
        ...notificationAudience(role),
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async unreadCount(role: Role) {
    return this.prisma.notification.count({
      where: {
        readAt: null,
        ...notificationAudience(role),
      },
    });
  }
}
