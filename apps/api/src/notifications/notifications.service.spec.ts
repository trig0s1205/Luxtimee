import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService.markAllRead', () => {
  it('marca como leídas solo las pendientes del rol', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { notification: { updateMany } };
    const service = new NotificationsService(prisma as never);

    await expect(service.markAllRead(Role.ADMIN)).resolves.toEqual({ updated: 3 });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        readAt: null,
        OR: [{ targetRole: Role.ADMIN }, { targetRole: null }],
      },
      data: { readAt: expect.any(Date) },
    });
  });
});
