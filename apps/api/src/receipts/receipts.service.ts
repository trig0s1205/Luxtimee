import { Injectable, Logger } from '@nestjs/common';
import {
  OrderStage,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Prisma,
  ReceiptChannel,
  type SaleReceipt,
} from '@prisma/client';
import { createHash } from 'crypto';
import {
  PAYMENT_METHOD_LABELS,
  type ReceiptConfigDto,
} from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  formatReceiptNumber,
  nextReceiptSequence,
} from './receipt-number.util';
import { computeWarrantyEnd, warrantyStatus } from './warranty.util';
import {
  ReceiptPdfRenderer,
  type ReceiptPdfInput,
} from './receipt-pdf.renderer';

const issueOrderInclude = {
  items: {
    include: {
      watch: {
        select: {
          sku: true,
          model: true,
          reference: true,
          limitedEditionNumber: true,
          warrantyMonths: true,
          brand: { select: { name: true } },
          warrantyTemplate: { select: { terms: true } },
        },
      },
    },
    orderBy: { id: 'asc' as const },
  },
  payments: {
    include: { registeredBy: { select: { name: true } } },
    orderBy: { paidAt: 'asc' as const },
  },
  seller: { select: { name: true } },
} satisfies Prisma.OrderInclude;

type IssueOrder = Prisma.OrderGetPayload<{ include: typeof issueOrderInclude }>;

export type IssueReceiptOpts = {
  channel: 'WEB' | 'LOCAL';
  saleDate: Date;
  sellerId?: string | null;
  backfilled?: boolean;
  config?: ReceiptConfigDto;
};

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly pdfRenderer: ReceiptPdfRenderer,
  ) {}

  async issueInTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    opts: IssueReceiptOpts,
  ): Promise<SaleReceipt> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
    `;
    if (!locked.length) {
      throw new Error(`Pedido no encontrado: ${orderId}`);
    }

    const existing = await tx.saleReceipt.findUnique({
      where: { orderId },
    });
    if (existing) return existing;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: issueOrderInclude,
    });

    const config = opts.config ?? (await this.settings.getReceiptConfig());
    const sequence = await nextReceiptSequence(tx);
    const number = formatReceiptNumber(sequence);

    const customerName =
      order.customerName?.trim() || 'Cliente de mostrador';
    const customerEmail = order.customerEmail?.trim() || null;
    const sellerName = this.resolveSellerName(order);

    const { warrantyTerms, footerNote: _footerNote, ...businessFields } = config;
    const businessSnapshot = { ...businessFields };

    const paymentsSnapshot = this.buildPaymentsSnapshot(order);

    try {
      const receipt = await tx.saleReceipt.create({
        data: {
          number,
          sequence,
          orderId: order.id,
          orderReadableId: order.readableId,
          channel:
            opts.channel === 'LOCAL'
              ? ReceiptChannel.LOCAL
              : ReceiptChannel.WEB,
          saleDate: opts.saleDate,
          backfilled: opts.backfilled ?? false,
          customerName,
          customerDocument: order.customerDocument ?? null,
          customerPhone: order.customerPhone ?? null,
          customerEmail,
          sellerId: opts.sellerId ?? order.sellerId ?? null,
          sellerName,
          subtotal: order.subtotal,
          shippingCost: order.shippingCost,
          total: order.total,
          businessSnapshot,
          warrantyTerms,
          paymentsSnapshot,
          items: {
            create: order.items.map((item, position) => {
              const watch = item.watch;
              const warrantyMonths = watch?.warrantyMonths ?? 0;
              return {
                position,
                productName: item.productName,
                brandName: watch?.brand?.name ?? null,
                model: watch?.model ?? null,
                reference: watch?.reference ?? item.productRef ?? null,
                sku: item.productSku || watch?.sku || 'SIN-SKU',
                limitedEditionNumber: watch?.limitedEditionNumber ?? null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.unitPrice * item.quantity,
                warrantyMonths,
                warrantyStartsAt: opts.saleDate,
                warrantyEndsAt: computeWarrantyEnd(
                  opts.saleDate,
                  warrantyMonths,
                ),
                warrantyExtraTerms: watch?.warrantyTemplate?.terms ?? null,
              };
            }),
          },
        },
      });
      return receipt;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.saleReceipt.findUnique({
          where: { orderId },
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  async ensureForOrder(orderId: string): Promise<SaleReceipt | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        stage: true,
        status: true,
        type: true,
        source: true,
        canceledAt: true,
        paidAt: true,
        deliveredAt: true,
        sellerId: true,
      },
    });
    if (!order) return null;
    if (order.stage !== OrderStage.ORDER || order.canceledAt) return null;
    const eligible =
      order.type === OrderType.ESPECIAL ||
      order.status === OrderStatus.PAGADO ||
      order.status === OrderStatus.ENVIADO ||
      order.status === OrderStatus.ENTREGADO;
    if (!eligible) return null;

    const config = await this.settings.getReceiptConfig();
    const saleDate = order.paidAt ?? order.deliveredAt ?? new Date();
    const channel = order.source === 'LOCAL' ? 'LOCAL' : 'WEB';

    return this.prisma.$transaction(async (tx) =>
      this.issueInTx(tx, orderId, {
        channel,
        saleDate,
        sellerId: order.sellerId,
        config,
      }),
    );
  }

  async voidForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    reason: string,
  ): Promise<void> {
    const receipt = await tx.saleReceipt.findUnique({
      where: { orderId },
      select: { id: true, voidedAt: true },
    });
    if (!receipt || receipt.voidedAt) return;
    await tx.saleReceipt.update({
      where: { id: receipt.id },
      data: { voidedAt: new Date(), voidReason: reason },
    });
    await tx.saleReceiptPdf.deleteMany({ where: { receiptId: receipt.id } });
  }

  async getPdf(
    receiptId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const existing = await this.prisma.saleReceiptPdf.findUnique({
      where: { receiptId },
    });
    if (existing) {
      const receipt = await this.prisma.saleReceipt.findUniqueOrThrow({
        where: { id: receiptId },
        select: { number: true },
      });
      return {
        filename: `Comprobante-${receipt.number}.pdf`,
        buffer: Buffer.from(existing.data),
      };
    }

    const receipt = await this.prisma.saleReceipt.findUniqueOrThrow({
      where: { id: receiptId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    const input = this.toPdfInput(receipt);
    const buffer = await this.pdfRenderer.render(input);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const pdfBytes = Uint8Array.from(buffer);
    await this.prisma.saleReceiptPdf.upsert({
      where: { receiptId },
      create: { receiptId, data: pdfBytes, sha256 },
      update: { data: pdfBytes, sha256 },
    });
    return {
      filename: `Comprobante-${receipt.number}.pdf`,
      buffer,
    };
  }

  toDto(receipt: SaleReceipt & { items?: Array<Record<string, unknown>> }) {
    const items = (receipt.items ?? []).map((item) => {
      const endsAt = item.warrantyEndsAt as Date | null | undefined;
      const status = warrantyStatus(endsAt ?? null);
      return {
        ...item,
        warrantyStartsAt:
          item.warrantyStartsAt instanceof Date
            ? item.warrantyStartsAt.toISOString()
            : item.warrantyStartsAt,
        warrantyEndsAt:
          endsAt instanceof Date ? endsAt.toISOString() : endsAt ?? null,
        warrantyStatus: status.state,
        daysLeft: status.daysLeft,
      };
    });
    return {
      id: receipt.id,
      number: receipt.number,
      sequence: receipt.sequence,
      orderId: receipt.orderId,
      orderReadableId: receipt.orderReadableId,
      channel: receipt.channel,
      saleDate: receipt.saleDate.toISOString(),
      issuedAt: receipt.issuedAt.toISOString(),
      voidedAt: receipt.voidedAt?.toISOString() ?? null,
      voidReason: receipt.voidReason,
      backfilled: receipt.backfilled,
      customerName: receipt.customerName,
      customerDocument: receipt.customerDocument,
      customerPhone: receipt.customerPhone,
      customerEmail: receipt.customerEmail,
      sellerId: receipt.sellerId,
      sellerName: receipt.sellerName,
      subtotal: receipt.subtotal,
      shippingCost: receipt.shippingCost,
      total: receipt.total,
      warrantyTerms: receipt.warrantyTerms,
      paymentsSnapshot: receipt.paymentsSnapshot,
      businessSnapshot: receipt.businessSnapshot,
      items,
    };
  }

  async findById(id: string) {
    const receipt = await this.prisma.saleReceipt.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!receipt) return null;
    return this.toDto(receipt);
  }

  private resolveSellerName(order: IssueOrder): string {
    if (order.seller?.name?.trim()) return order.seller.name.trim();
    const lastPayment = [...order.payments].reverse().find((p) => p.registeredBy?.name);
    if (lastPayment?.registeredBy?.name?.trim()) {
      return lastPayment.registeredBy.name.trim();
    }
    return 'Tienda web';
  }

  private buildPaymentsSnapshot(order: IssueOrder) {
    const payments = order.payments;
    if (!payments.length) {
      return [
        {
          method: PaymentMethod.NO_ESPECIFICADO,
          label: PAYMENT_METHOD_LABELS[PaymentMethod.NO_ESPECIFICADO],
          amount: order.total,
          reference: null,
          cardLast4: null,
          cashReceived: null,
          changeGiven: null,
          paidAt: order.paidAt?.toISOString() ?? null,
        },
      ];
    }
    const withMethod = payments.filter((p) => p.method != null);
    if (!withMethod.length) {
      return [
        {
          method: PaymentMethod.NO_ESPECIFICADO,
          label: PAYMENT_METHOD_LABELS[PaymentMethod.NO_ESPECIFICADO],
          amount: order.total,
          reference: null,
          cardLast4: null,
          cashReceived: null,
          changeGiven: null,
          paidAt: payments[0]?.paidAt?.toISOString() ?? null,
        },
      ];
    }
    return payments.map((p) => {
      const method = p.method ?? PaymentMethod.NO_ESPECIFICADO;
      return {
        method,
        label: PAYMENT_METHOD_LABELS[method],
        amount: p.amount,
        reference: p.reference ?? null,
        cardLast4: p.cardLast4 ?? null,
        cashReceived: p.cashReceived ?? null,
        changeGiven: p.changeGiven ?? null,
        paidAt: p.paidAt.toISOString(),
      };
    });
  }

  private toPdfInput(
    receipt: SaleReceipt & {
      items: Array<{
        productName: string;
        brandName: string | null;
        model: string | null;
        reference: string | null;
        sku: string;
        limitedEditionNumber: string | null;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        warrantyMonths: number;
        warrantyStartsAt: Date;
        warrantyEndsAt: Date | null;
        warrantyExtraTerms: string | null;
      }>;
    },
  ): ReceiptPdfInput {
    const business = (receipt.businessSnapshot ?? {}) as unknown as ReceiptConfigDto;
    const payments = Array.isArray(receipt.paymentsSnapshot)
      ? (receipt.paymentsSnapshot as ReceiptPdfInput['payments'])
      : [];
    return {
      number: receipt.number,
      channel: receipt.channel,
      saleDate: receipt.saleDate,
      issuedAt: receipt.issuedAt,
      orderReadableId: receipt.orderReadableId,
      customerName: receipt.customerName,
      customerDocument: receipt.customerDocument,
      customerPhone: receipt.customerPhone,
      customerEmail: receipt.customerEmail,
      sellerName: receipt.sellerName,
      subtotal: receipt.subtotal,
      shippingCost: receipt.shippingCost,
      total: receipt.total,
      warrantyTerms: receipt.warrantyTerms,
      footerNote: business.footerNote ?? '',
      backfilled: receipt.backfilled,
      voidedAt: receipt.voidedAt,
      voidReason: receipt.voidReason,
      businessSnapshot: {
        businessName: business.businessName ?? 'LUXTIMEE',
        ownerName: business.ownerName ?? '',
        ownerDocument: business.ownerDocument ?? '',
        phone: business.phone ?? '',
        whatsapp: business.whatsapp ?? '',
        email: business.email ?? '',
        city: business.city ?? '',
        address: business.address ?? '',
        logoUrl: business.logoUrl ?? '',
        footerNote: business.footerNote ?? '',
      },
      payments,
      items: receipt.items,
    };
  }
}
