import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderSource, OrderStatus, Role } from '@prisma/client';
import { PosService } from './pos.service';

const admin = {
  id: 'admin-1',
  email: 'admin@pos.local',
  name: 'Admin',
  role: Role.ADMIN,
};

function serviceWith(orderApi: Record<string, unknown>) {
  return new PosService(
    { order: orderApi } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('PosService.hideSale', () => {
  it('rechaza con 400 si la venta no está anulada', async () => {
    const update = jest.fn();
    const service = serviceWith({
      findUnique: jest.fn(async () => ({
        id: 'o1',
        source: OrderSource.LOCAL,
        status: OrderStatus.ENTREGADO,
        hiddenAt: null,
        receipt: { voidedAt: null },
      })),
      update,
    });
    await expect(service.hideSale('o1', admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('oculta una venta anulada y es idempotente', async () => {
    const hiddenAt = new Date('2026-11-26T12:00:00.000Z');
    const update = jest.fn(async () => ({ id: 'o1' }));
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'o1',
        source: OrderSource.LOCAL,
        status: OrderStatus.CANCELADO,
        hiddenAt: null,
        receipt: { voidedAt: hiddenAt },
      })
      .mockResolvedValueOnce({
        id: 'o1',
        source: OrderSource.LOCAL,
        status: OrderStatus.CANCELADO,
        hiddenAt,
        receipt: { voidedAt: hiddenAt },
      });
    const service = serviceWith({ findUnique, update });

    const first = await service.hideSale('o1', admin);
    expect(first.alreadyHidden).toBe(false);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { hiddenAt: expect.any(Date), hiddenById: 'admin-1' },
    });

    const second = await service.hideSale('o1', admin);
    expect(second).toEqual({
      orderId: 'o1',
      hiddenAt: hiddenAt.toISOString(),
      alreadyHidden: true,
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('404 si no es una venta local', async () => {
    const service = serviceWith({
      findUnique: jest.fn(async () => ({
        id: 'o1',
        source: OrderSource.WEB,
        status: OrderStatus.CANCELADO,
        hiddenAt: null,
        receipt: null,
      })),
    });
    await expect(service.hideSale('o1', admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PosService.mySales', () => {
  it('excluye ventas ocultas del listado', async () => {
    const findMany = jest.fn(async () => []);
    const count = jest.fn(async () => 0);
    const service = serviceWith({ findMany, count });
    await service.mySales({ date: '2026-11-26' }, admin);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: OrderSource.LOCAL,
          hiddenAt: null,
        }),
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({ hiddenAt: null }),
    });
  });
});
