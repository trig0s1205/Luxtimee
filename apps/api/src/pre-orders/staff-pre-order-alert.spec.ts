import { OrderSource, OrderType, PriceType } from '@prisma/client';
import { formatCopAmount } from '@luxtime/shared';
import { PreOrdersService } from './pre-orders.service';

jest.mock('../common/utils/watch-stock.tx', () => ({
  STOCK_TRANSACTION: { maxWait: 1, timeout: 1 },
  reserveWatchStock: jest.fn(async () => undefined),
  restoreWatchStock: jest.fn(async () => undefined),
}));

jest.mock('../common/utils/document-counter.util', () => ({
  nextOrderReadableId: jest.fn(async () => 'LX-20261120-0007'),
}));

const READABLE = 'LX-20261120-0007';

function watchRow() {
  return {
    id: 'w1',
    sku: 'SKU-1',
    slug: 'reloj-ana',
    model: 'Datejust',
    stock: 4,
    isActive: true,
    retailPrice: 150_000,
    wholesalePrice: 120_000,
    frontImageUrl: null,
    reference: null,
    dialColor: null,
    caseMaterial: null,
    caseDiameter: null,
    bezelMaterial: null,
    strapMaterial: null,
    movementType: null,
    isLimitedEdition: false,
    limitedEditionNumber: null,
    brand: { name: 'Rolex' },
    category: { name: 'Clásico' },
  };
}

function savedOrder(data: {
  readableId: string;
  source: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string;
  customerAddress: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  depositExpected: number;
  type: string;
  items: { create: Array<Record<string, unknown>> };
}) {
  const now = new Date('2026-11-20T12:00:00.000Z');
  return {
    id: 'order-1',
    stage: 'PRE_ORDER',
    status: null,
    depositConfirmed: false,
    wholesaleAccessId: null,
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    canceledAt: null,
    suspendedAt: null,
    preOrderActiveAt: now,
    createdAt: now,
    updatedAt: now,
    shippingZone: null,
    payments: [],
    ...data,
    customerPhone: data.customerPhone ?? null,
    customerEmail: data.customerEmail ?? '',
    items: data.items.create.map((item, index) => ({
      id: `item-${index}`,
      deliveryNote: null,
      extrasSnapshot: [],
      packageName: null,
      packageId: null,
      ...item,
      watch: { sku: item.productSku, frontImageUrl: null },
    })),
  };
}

function buildService(options?: {
  send?: jest.Mock;
  users?: Array<{ email: string; role: string }>;
}) {
  const users = options?.users ?? [
    { email: 'admin@luxtimee.test', role: 'ADMIN' },
    { email: 'super@luxtimee.test', role: 'SUPER_ADMIN' },
    { email: '   ', role: 'ADMIN' },
    { email: 'vendedor@luxtimee.test', role: 'VENDEDOR_LOCAL' },
    { email: 'cliente@luxtimee.test', role: 'CUSTOMER' },
  ];
  const send = options?.send ?? jest.fn(async () => ({ sent: true, provider: 'smtp' as const }));
  const notifyStaff = jest.fn();
  const emitted: string[] = [];
  const tx = {
    order: {
      create: async ({ data }: { data: Parameters<typeof savedOrder>[0] }) => savedOrder(data),
    },
  };
  const prisma = {
    watch: { findMany: async () => [watchRow()] },
    user: {
      findMany: async ({ where }: { where: { role: { in: string[] } } }) =>
        users
          .filter((user) => where.role.in.includes(user.role))
          .map((user) => ({ email: user.email })),
    },
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const service = new PreOrdersService(
    prisma as never,
    {
      emit: async () => {
        emitted.push('emit');
        return { id: 'n1' };
      },
    } as never,
    { getWhatsappLink: async () => ({ url: 'https://wa.me/573000000000', messagePrefix: 'Hola' }) } as never,
    {
      buildCheckoutMessage: () => 'mensaje',
      buildRedirectUrl: () => 'https://wa.me/send',
      notifyStaff,
    } as never,
    {} as never,
    {} as never,
    { notifyOrder: async () => ({ emailed: false, whatsappUrl: null }) } as never,
    { invalidateTag: () => undefined } as never,
    { send } as never,
    { get: (key: string) => (key === 'FRONTEND_URL' ? 'https://tienda.test/' : undefined) } as never,
  );
  return { service, send, notifyStaff, emitted };
}

const dto = {
  customerName: 'Ana Pérez',
  customerAddress: 'Calle 1',
  customerPhone: '3001234567',
  consentAccepted: true,
  items: [{ watchId: 'w1', quantity: 2 }],
};

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('aviso de pre-pedido al staff', () => {
  it('envía el correo a admin y super admin con el resumen y el enlace', async () => {
    const { service, send, notifyStaff, emitted } = buildService();
    const result = await service.createPublic(dto);

    expect(result.order.readableId).toBe(READABLE);
    expect(result.order.source).toBe(OrderSource.WEB);
    expect(result.order.type).toBe(OrderType.DETAL);
    expect(emitted).toEqual(['emit']);
    await flush();

    const total = formatCopAmount(300_000);
    expect(send).toHaveBeenCalledTimes(2);
    const recipients = send.mock.calls.map((call) => call[0].to).sort();
    expect(recipients).toEqual(['admin@luxtimee.test', 'super@luxtimee.test']);
    for (const [mail] of send.mock.calls) {
      expect(mail.subject).toContain(READABLE);
      expect(mail.text).toContain('Origen: WEB');
      expect(mail.text).toContain('Ana Pérez');
      expect(mail.text).toContain('Ítems: 2');
      expect(mail.text).toContain(total);
      expect(mail.text).toContain('SKU: SKU-1');
      expect(mail.text).toContain('https://tienda.test/admin/pre-pedidos/activos');
      expect(mail.html).toContain('/admin/pre-pedidos/activos');
    }
    expect(notifyStaff).not.toHaveBeenCalled();
    expect(result.order.items[0]?.priceType).toBe(PriceType.RETAIL);
  });

  it('si el mailer lanza, el pre-pedido igual queda creado', async () => {
    const send = jest.fn(async () => {
      throw new Error('smtp down');
    });
    const { service, notifyStaff } = buildService({ send });
    const result = await service.createPublic(dto);
    expect(result.order.readableId).toBe(READABLE);
    await flush();
    expect(send).toHaveBeenCalled();
    expect(notifyStaff).not.toHaveBeenCalled();
  });

  it('no espera al correo para responder', async () => {
    let release: (value: { sent: boolean; provider: 'noop' }) => void = () => undefined;
    const send = jest.fn(
      () =>
        new Promise<{ sent: boolean; provider: 'noop' }>((resolve) => {
          release = resolve;
        }),
    );
    const { service } = buildService({ send });
    const pending = service.createPublic(dto);
    const raced = await Promise.race([
      pending.then(() => 'created' as const),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 200)),
    ]);
    expect(raced).toBe('created');
    release({ sent: false, provider: 'noop' });
    await pending;
    await flush();
    expect(send).toHaveBeenCalled();
  });
});
