import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrderSource, OrderStage, OrderStatus, Role } from '@prisma/client';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { AUDIT_KEY, ROLES_KEY } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import * as stockTx from '../common/utils/watch-stock.tx';
import { todayBogotaYmd } from '../receipts/bogota-time.util';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

const paidAt = new Date('2026-11-20T18:30:00.000Z');
const admin = {
  id: 'admin-1',
  email: 'admin@pos.local',
  name: 'Admin',
  role: Role.ADMIN,
};
const seller = {
  id: 'seller-1',
  email: 'seller@pos.local',
  name: 'Vendedor',
  role: Role.VENDEDOR_LOCAL,
};

function localOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    readableId: 'LX-1',
    stage: OrderStage.ORDER,
    source: OrderSource.LOCAL,
    status: OrderStatus.ENTREGADO,
    canceledAt: null as Date | null,
    paidAt,
    createdAt: paidAt,
    sellerId: 'seller-1',
    items: [{ watchId: 'w1', quantity: 2 }],
    receipt: { id: 'r1', voidedAt: null as Date | null },
    ...overrides,
  };
}

function build(order: ReturnType<typeof localOrder> | null, closing: { id: string } | null = null) {
  const update = jest.fn(async () => undefined);
  const cashUpdate = jest.fn();
  const cashDelete = jest.fn();
  const voidForOrder = jest.fn(async () => undefined);
  const invalidateTag = jest.fn();
  const tx = {
    $queryRaw: jest.fn(async () => (order ? [{ id: order.id }] : [])),
    order: {
      findUnique: jest.fn(async () => order),
      update,
    },
    cashClosing: {
      findUnique: jest.fn(async () => closing),
      update: cashUpdate,
      delete: cashDelete,
    },
    saleReceipt: {
      findUnique: jest.fn(async () =>
        order
          ? {
              voidedAt: new Date('2026-11-20T19:00:00.000Z'),
              voidReason: 'Cliente devolvió el reloj',
            }
          : null,
      ),
    },
  };
  const $transaction = jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));
  const service = new PosService(
    { $transaction } as never,
    {} as never,
    { voidForOrder } as never,
    { emit: jest.fn() } as never,
    { invalidateTag } as never,
    {} as never,
  );
  return { service, tx, update, cashUpdate, cashDelete, voidForOrder, invalidateTag, $transaction };
}

function httpContext(role: Role): ExecutionContext {
  return {
    getHandler: () => PosController.prototype.voidSale,
    getClass: () => PosController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { role, id: 'u' } }),
    }),
  } as unknown as ExecutionContext;
}

describe('PosService.voidSale', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('anula, repone stock e invalida el catálogo sin tocar el cierre', async () => {
    const restore = jest.spyOn(stockTx, 'restoreWatchStock').mockResolvedValue(undefined);
    const { service, tx, update, cashUpdate, cashDelete, voidForOrder, invalidateTag } = build(
      localOrder(),
    );

    const result = await service.voidSale('o1', '  Cliente devolvió el reloj  ', admin);

    expect(restore).toHaveBeenCalledWith(tx, [{ watchId: 'w1', quantity: 2 }]);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: {
        status: OrderStatus.CANCELADO,
        canceledAt: expect.any(Date),
      },
    });
    expect(voidForOrder).toHaveBeenCalledWith(tx, 'o1', 'Cliente devolvió el reloj');
    expect(cashUpdate).not.toHaveBeenCalled();
    expect(cashDelete).not.toHaveBeenCalled();
    expect(invalidateTag).toHaveBeenCalledTimes(1);
    expect(invalidateTag).toHaveBeenCalledWith(CACHE_TAGS.catalog);
    expect(result).toMatchObject({
      orderId: 'o1',
      readableId: 'LX-1',
      status: 'CANCELADO',
      afterCashClosing: false,
      receipt: {
        voidedAt: '2026-11-20T19:00:00.000Z',
        voidReason: 'Cliente devolvió el reloj',
      },
    });
  });

  it('marca afterCashClosing si ya hay cierre del vendedor en esa fecha de Bogotá', async () => {
    jest.spyOn(stockTx, 'restoreWatchStock').mockResolvedValue(undefined);
    const { service, tx, cashUpdate, cashDelete } = build(localOrder(), { id: 'c1' });

    const result = await service.voidSale('o1', 'Cliente devolvió el reloj', {
      ...admin,
      role: Role.SUPER_ADMIN,
    });

    expect(result.afterCashClosing).toBe(true);
    expect(tx.cashClosing.findUnique).toHaveBeenCalledWith({
      where: {
        businessDate_userId: {
          businessDate: new Date(`${todayBogotaYmd(paidAt)}T00:00:00.000Z`),
          userId: 'seller-1',
        },
      },
      select: { id: true },
    });
    expect(cashUpdate).not.toHaveBeenCalled();
    expect(cashDelete).not.toHaveBeenCalled();
  });

  it('responde 409 si la venta ya está anulada y no invalida caché', async () => {
    const restore = jest.spyOn(stockTx, 'restoreWatchStock').mockResolvedValue(undefined);
    const canceled = build(localOrder({ canceledAt: new Date(), status: OrderStatus.CANCELADO }));
    await expect(
      canceled.service.voidSale('o1', 'Cliente devolvió el reloj', admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(canceled.update).not.toHaveBeenCalled();
    expect(canceled.invalidateTag).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();

    const voidedReceipt = build(
      localOrder({ receipt: { id: 'r1', voidedAt: new Date() } }),
    );
    await expect(
      voidedReceipt.service.voidSale('o1', 'Cliente devolvió el reloj', admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(voidedReceipt.update).not.toHaveBeenCalled();
  });

  it('rechaza pedidos que no son del local', async () => {
    const restore = jest.spyOn(stockTx, 'restoreWatchStock').mockResolvedValue(undefined);
    const { service, update, invalidateTag } = build(
      localOrder({ source: OrderSource.WEB }),
    );
    await expect(
      service.voidSale('o1', 'Cliente devolvió el reloj', admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
    expect(invalidateTag).not.toHaveBeenCalled();
  });

  it('403 para VENDEDOR_LOCAL antes de abrir la transacción', async () => {
    const { service, $transaction } = build(localOrder());
    await expect(
      service.voidSale('o1', 'Cliente devolvió el reloj', seller),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('404 si la venta no existe', async () => {
    const { service } = build(null);
    await expect(
      service.voidSale('missing', 'Cliente devolvió el reloj', admin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mySales incluye voidedAt y voidReason', async () => {
    const voidedAt = new Date('2026-11-20T19:00:00.000Z');
    const service = new PosService(
      {
        order: {
          count: jest.fn(async () => 1),
          findMany: jest.fn(async () => [
            {
              id: 'o1',
              readableId: 'LX-1',
              createdAt: paidAt,
              customerName: 'Ana',
              total: 100_000,
              status: OrderStatus.CANCELADO,
              payments: [{ method: 'EFECTIVO' }],
              receipt: {
                id: 'r1',
                number: 'LXT-000001',
                voidedAt,
                voidReason: 'Cliente devolvió el reloj',
              },
              seller: { name: 'Vend' },
            },
          ]),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const page = await service.mySales({}, admin);
    expect(page.items[0]).toMatchObject({
      receiptVoided: true,
      receipt: {
        voidedAt: voidedAt.toISOString(),
        voidReason: 'Cliente devolvió el reloj',
      },
    });
  });
});

describe('POST /pos/sales/:id/void permisos y auditoría', () => {
  const guard = new RolesGuard(new Reflector());

  it('solo ADMIN y SUPER_ADMIN, con auditoría VOID Order', () => {
    expect(Reflect.getMetadata(AUDIT_KEY, PosController.prototype.voidSale)).toEqual({
      action: 'VOID',
      entity: 'Order',
    });
    expect(Reflect.getMetadata(ROLES_KEY, PosController.prototype.voidSale)).toEqual([
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);
    expect(() => guard.canActivate(httpContext(Role.VENDEDOR_LOCAL))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(httpContext(Role.ADMIN))).toBe(true);
    expect(guard.canActivate(httpContext(Role.SUPER_ADMIN))).toBe(true);
  });
});
