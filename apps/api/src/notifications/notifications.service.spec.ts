import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';

const staffAudience = {
  OR: [
    { targetRole: null },
    { targetRole: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
  ],
};

describe('NotificationsService', () => {
  it('marca como leídas las pendientes de admin y super admin', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { notification: { updateMany } };
    const service = new NotificationsService(prisma as never);

    await expect(service.markAllRead(Role.ADMIN)).resolves.toEqual({ updated: 3 });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        readAt: null,
        ...staffAudience,
      },
      data: { readAt: expect.any(Date) },
    });
  });

  it('el super admin ve los avisos emitidos para ADMIN', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'n1', type: 'NEW_PRE_ORDER', targetRole: Role.ADMIN },
    ]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = { notification: { findMany, count } };
    const service = new NotificationsService(prisma as never);

    await expect(service.listForStaff(Role.SUPER_ADMIN)).resolves.toHaveLength(1);
    await expect(service.unreadCount(Role.SUPER_ADMIN)).resolves.toBe(1);
    expect(findMany).toHaveBeenCalledWith({
      where: staffAudience,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        readAt: null,
        ...staffAudience,
      },
    });
  });

  it('elimina una notificación de la bandeja compartida', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'n1' });
    const del = jest.fn().mockResolvedValue({ id: 'n1' });
    const prisma = { notification: { findFirst, delete: del } };
    const service = new NotificationsService(prisma as never);

    await expect(service.deleteOne('n1', Role.ADMIN)).resolves.toEqual({ deleted: 1 });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'n1', ...staffAudience },
    });
    expect(del).toHaveBeenCalledWith({ where: { id: 'n1' } });
  });

  it('elimina todas las leídas de la bandeja compartida', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 4 });
    const prisma = { notification: { deleteMany } };
    const service = new NotificationsService(prisma as never);

    await expect(service.deleteRead(Role.SUPER_ADMIN)).resolves.toEqual({ deleted: 4 });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        readAt: { not: null },
        ...staffAudience,
      },
    });
  });
});
