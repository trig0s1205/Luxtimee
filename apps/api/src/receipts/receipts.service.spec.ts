import { OrderStage, OrderStatus, OrderType } from '@prisma/client';
import { ReceiptsService } from './receipts.service';
import { ReceiptPdfRenderer } from './receipt-pdf.renderer';

const config = {
  businessName: 'LUXTIMEE',
  ownerName: '',
  ownerDocument: '',
  phone: '',
  whatsapp: '',
  email: 'help@luxtime.co',
  city: 'Piedecuesta',
  address: '',
  logoUrl: '',
  warrantyTerms: 'Términos por defecto.',
  footerNote: '',
};

function buildService(prisma: Record<string, unknown>, pdf?: ReceiptPdfRenderer) {
  return new ReceiptsService(
    prisma as never,
    { getReceiptConfig: jest.fn(async () => config) } as never,
    pdf ?? new ReceiptPdfRenderer(),
  );
}

describe('ReceiptsService', () => {
  it('emite con snapshot (garantía de watch, cliente vacío → Cliente de mostrador)', async () => {
    const created: Record<string, unknown> = {};
    const queryRaw = jest.fn();
    queryRaw
      .mockResolvedValueOnce([{ id: 'o1' }])
      .mockResolvedValueOnce([{ lastValue: 1 }]);
    const tx = {
      $queryRaw: queryRaw,
      saleReceipt: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(created, data, { id: 'r1', number: data.number });
          return created;
        }),
      },
      order: {
        findUniqueOrThrow: jest.fn(async () => ({
          id: 'o1',
          readableId: 'LX-1',
          customerName: '  ',
          customerDocument: null,
          customerPhone: null,
          customerEmail: '',
          sellerId: null,
          seller: null,
          subtotal: 100_000,
          shippingCost: 0,
          total: 100_000,
          paidAt: new Date('2026-01-15T15:00:00.000Z'),
          items: [
            {
              id: 'i1',
              productName: 'Casio A',
              productSku: 'RM-001',
              productRef: 'REF',
              unitPrice: 100_000,
              quantity: 1,
              watch: {
                sku: 'RM-001',
                model: 'A',
                reference: 'REF',
                limitedEditionNumber: null,
                warrantyMonths: 12,
                brand: { name: 'Casio' },
                warrantyTemplate: null,
              },
            },
          ],
          payments: [],
        })),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
      saleReceipt: { findUnique: jest.fn() },
    };

    const service = buildService(prisma);
    const receipt = await service.issueInTx(tx as never, 'o1', {
      channel: 'WEB',
      saleDate: new Date('2026-01-15T15:00:00.000Z'),
      config,
    });

    expect(created.customerName).toBe('Cliente de mostrador');
    expect(created.number).toBe('LXT-000001');
    const itemsCreate = (created.items as { create: Array<{ warrantyMonths: number }> })
      .create;
    expect(itemsCreate[0].warrantyMonths).toBe(12);
    expect(receipt).toBe(created);
  });

  it('businessSnapshot incluye footerNote y no incluye warrantyTerms', async () => {
    const created: Record<string, unknown> = {};
    const queryRaw = jest.fn();
    queryRaw
      .mockResolvedValueOnce([{ id: 'o2' }])
      .mockResolvedValueOnce([{ lastValue: 2 }]);
    const cfg = {
      ...config,
      footerNote: 'Nota de pie de prueba',
      warrantyTerms: 'Términos solo en columna warrantyTerms',
    };
    const tx = {
      $queryRaw: queryRaw,
      saleReceipt: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(created, data, { id: 'r2', number: data.number });
          return created;
        }),
      },
      order: {
        findUniqueOrThrow: jest.fn(async () => ({
          id: 'o2',
          readableId: 'LX-2',
          customerName: 'Ana',
          customerDocument: null,
          customerPhone: null,
          customerEmail: '',
          sellerId: null,
          seller: null,
          subtotal: 50_000,
          shippingCost: 0,
          total: 50_000,
          paidAt: new Date('2026-01-15T15:00:00.000Z'),
          items: [
            {
              id: 'i2',
              productName: 'Casio B',
              productSku: 'RM-002',
              productRef: 'REF',
              unitPrice: 50_000,
              quantity: 1,
              watch: {
                sku: 'RM-002',
                model: 'B',
                reference: 'REF',
                limitedEditionNumber: null,
                warrantyMonths: 6,
                brand: { name: 'Casio' },
                warrantyTemplate: null,
              },
            },
          ],
          payments: [],
        })),
      },
    };

    await buildService({}).issueInTx(tx as never, 'o2', {
      channel: 'WEB',
      saleDate: new Date('2026-01-15T15:00:00.000Z'),
      config: cfg,
    });

    expect(created.warrantyTerms).toBe('Términos solo en columna warrantyTerms');
    expect(created.businessSnapshot).toMatchObject({
      footerNote: 'Nota de pie de prueba',
      businessName: 'LUXTIMEE',
    });
    expect(created.businessSnapshot).not.toHaveProperty('warrantyTerms');
  });

  it('segunda llamada es idempotente', async () => {
    const existing = { id: 'r1', number: 'LXT-000001', orderId: 'o1' };
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 'o1' }]),
      saleReceipt: {
        findUnique: jest.fn(async () => existing),
        create: jest.fn(),
      },
      order: { findUniqueOrThrow: jest.fn() },
    };
    const service = buildService({});
    const receipt = await service.issueInTx(tx as never, 'o1', {
      channel: 'WEB',
      saleDate: new Date(),
      config,
    });
    expect(receipt).toBe(existing);
    expect(tx.saleReceipt.create).not.toHaveBeenCalled();
  });

  it('pedido PENDIENTE → null en ensureForOrder', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn(async () => ({
          id: 'o1',
          stage: OrderStage.ORDER,
          status: OrderStatus.PENDIENTE,
          type: OrderType.DETAL,
          source: 'WEB',
          canceledAt: null,
          paidAt: null,
          deliveredAt: null,
          sellerId: null,
        })),
      },
      $transaction: jest.fn(),
    };
    const service = buildService(prisma);
    await expect(service.ensureForOrder('o1')).resolves.toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('getPdf dos veces usa el mismo buffer y llama al renderer una sola vez', async () => {
    const render = jest.fn(async () => Buffer.from('%PDF-fake'));
    const pdfRenderer = { render } as unknown as ReceiptPdfRenderer;
    let stored: { data: Buffer; sha256: string } | null = null;
    const receiptRow = {
      id: 'r1',
      number: 'LXT-000001',
      channel: 'WEB',
      saleDate: new Date(),
      issuedAt: new Date(),
      orderReadableId: 'LX-1',
      customerName: 'Ana',
      customerDocument: null,
      customerPhone: null,
      customerEmail: null,
      sellerName: 'Tienda web',
      subtotal: 1,
      shippingCost: 0,
      total: 1,
      warrantyTerms: 't',
      backfilled: false,
      voidedAt: null,
      voidReason: null,
      businessSnapshot: config,
      paymentsSnapshot: [],
      items: [
        {
          productName: 'A',
          brandName: 'B',
          model: 'M',
          reference: null,
          sku: 'RM-001',
          limitedEditionNumber: null,
          quantity: 1,
          unitPrice: 1,
          lineTotal: 1,
          warrantyMonths: 0,
          warrantyStartsAt: new Date(),
          warrantyEndsAt: null,
          warrantyExtraTerms: null,
        },
      ],
    };
    const prisma = {
      saleReceiptPdf: {
        findUnique: jest.fn(async () =>
          stored
            ? { data: stored.data, sha256: stored.sha256, receiptId: 'r1' }
            : null,
        ),
        upsert: jest.fn(async ({ create }: { create: { data: Buffer; sha256: string } }) => {
          stored = { data: create.data, sha256: create.sha256 };
          return stored;
        }),
      },
      saleReceipt: {
        findUniqueOrThrow: jest.fn(async () => receiptRow),
        findUnique: jest.fn(async () => ({ number: 'LXT-000001' })),
      },
    };
    const service = buildService(prisma, pdfRenderer);
    const first = await service.getPdf('r1');
    const second = await service.getPdf('r1');
    expect(first.buffer.equals(second.buffer)).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);
    expect(first.filename).toBe('Comprobante-LXT-000001.pdf');
  });
});
