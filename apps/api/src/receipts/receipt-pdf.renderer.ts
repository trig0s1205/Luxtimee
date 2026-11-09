import { Injectable } from '@nestjs/common';
import { formatCopAmount, PAYMENT_METHOD_LABELS } from '@luxtime/shared';
import PDFDocument from 'pdfkit';
import type { ReceiptConfigDto } from '@luxtime/shared';
import { formatBogotaDate, formatBogotaDateTime } from './bogota-time.util';

const BRAND = {
  gold: '#B8962E',
  goldLight: '#F5E9C8',
  dark: '#1A1A1A',
  gray: '#6B7280',
  rowAlt: '#FAF7F0',
  white: '#FFFFFF',
  border: '#E5E7EB',
} as const;

const MARGIN = 40;
const FOOTER_NOTE =
  'Documento interno de venta y garantía. No es factura electrónica de venta ni documento equivalente.';

export type ReceiptPdfPayment = {
  method: string;
  label?: string;
  amount: number;
  reference?: string | null;
  cardLast4?: string | null;
  cashReceived?: number | null;
  changeGiven?: number | null;
  paidAt?: string | null;
};

export type ReceiptPdfItem = {
  productName: string;
  brandName?: string | null;
  model?: string | null;
  reference?: string | null;
  sku: string;
  limitedEditionNumber?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  warrantyMonths: number;
  warrantyStartsAt: Date;
  warrantyEndsAt: Date | null;
  warrantyExtraTerms?: string | null;
};

export type ReceiptPdfInput = {
  number: string;
  channel: 'WEB' | 'LOCAL';
  saleDate: Date;
  issuedAt: Date;
  orderReadableId: string;
  customerName: string;
  customerDocument?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  sellerName: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  warrantyTerms: string;
  footerNote?: string | null;
  backfilled?: boolean;
  voidedAt?: Date | null;
  voidReason?: string | null;
  businessSnapshot: Omit<ReceiptConfigDto, 'warrantyTerms' | 'footerNote'> & {
    footerNote?: string;
  };
  payments: ReceiptPdfPayment[];
  items: ReceiptPdfItem[];
  compress?: boolean;
};

@Injectable()
export class ReceiptPdfRenderer {
  async render(receipt: ReceiptPdfInput): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: MARGIN,
      bufferPages: true,
      compress: receipt.compress !== false,
      info: {
        Title: `Comprobante de venta y garantía ${receipt.number}`,
        Author: receipt.businessSnapshot.businessName || 'LUXTIMEE',
        CreationDate: receipt.issuedAt,
      },
    });

    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - MARGIN * 2;
    let y = MARGIN;

    const logoDrawn = await this.tryDrawLogo(
      doc,
      receipt.businessSnapshot.logoUrl,
      receipt.businessSnapshot.businessName,
      MARGIN,
      y,
    );
    if (!logoDrawn) {
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(BRAND.gold)
        .text(receipt.businessSnapshot.businessName || 'LUXTIMEE', MARGIN, y, {
          width: contentWidth * 0.45,
        });
    }

    const rightX = MARGIN + contentWidth * 0.5;
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(BRAND.dark)
      .text('COMPROBANTE DE VENTA Y GARANTÍA', rightX, y, {
        width: contentWidth * 0.5,
        align: 'right',
      });
    y += 16;
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(BRAND.dark)
      .text(`N.º ${receipt.number}`, rightX, y, {
        width: contentWidth * 0.5,
        align: 'right',
      });
    y += 14;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(BRAND.gray)
      .text(`Fecha de venta: ${formatBogotaDateTime(receipt.saleDate)}`, rightX, y, {
        width: contentWidth * 0.5,
        align: 'right',
      });
    y += 12;
    doc.text(
      `Canal: ${receipt.channel === 'LOCAL' ? 'Local físico' : 'Tienda web'}`,
      rightX,
      y,
      { width: contentWidth * 0.5, align: 'right' },
    );
    y += 12;
    doc.text(`Pedido: ${receipt.orderReadableId}`, rightX, y, {
      width: contentWidth * 0.5,
      align: 'right',
    });

    y = Math.max(y + 20, MARGIN + 70);

    if (receipt.voidedAt) {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#B91C1C')
        .text(
          `Anulado el ${formatBogotaDateTime(receipt.voidedAt)}: ${receipt.voidReason ?? ''}`,
          MARGIN,
          y,
          { width: contentWidth },
        );
      y += 18;
    }

    y = this.sectionTitle(doc, 'Datos del negocio', y);
    const bizLines = [
      receipt.businessSnapshot.businessName,
      [receipt.businessSnapshot.ownerName, receipt.businessSnapshot.ownerDocument]
        .filter(Boolean)
        .join(' · '),
      receipt.businessSnapshot.phone
        ? `Tel: ${receipt.businessSnapshot.phone}`
        : '',
      receipt.businessSnapshot.whatsapp
        ? `WhatsApp: ${receipt.businessSnapshot.whatsapp}`
        : '',
      receipt.businessSnapshot.email,
      [receipt.businessSnapshot.city, receipt.businessSnapshot.address]
        .filter(Boolean)
        .join(' — '),
    ].filter((line) => line && String(line).trim());
    for (const line of bizLines) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(BRAND.dark)
        .text(line, MARGIN, y, { width: contentWidth });
      y += 12;
    }
    y += 8;

    y = this.sectionTitle(doc, 'Cliente', y);
    const clientLines = [
      receipt.customerName,
      receipt.customerDocument ? `Documento: ${receipt.customerDocument}` : '',
      receipt.customerPhone ? `Teléfono: ${receipt.customerPhone}` : '',
      receipt.customerEmail ? `Correo: ${receipt.customerEmail}` : '',
    ].filter((line) => line && String(line).trim());
    for (const line of clientLines) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(BRAND.dark)
        .text(line, MARGIN, y, { width: contentWidth });
      y += 12;
    }
    y += 10;

    y = this.sectionTitle(doc, 'Productos', y);
    const cols = {
      product: { x: MARGIN, w: 170 },
      ref: { x: MARGIN + 170, w: 70 },
      sku: { x: MARGIN + 240, w: 70 },
      qty: { x: MARGIN + 310, w: 35 },
      unit: { x: MARGIN + 345, w: 80 },
      total: { x: MARGIN + 425, w: contentWidth - 425 },
    };
    doc.rect(MARGIN, y, contentWidth, 18).fill(BRAND.dark);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND.white);
    doc.text('Producto', cols.product.x + 4, y + 5, { width: cols.product.w - 8 });
    doc.text('Referencia', cols.ref.x + 4, y + 5, { width: cols.ref.w - 8 });
    doc.text('SKU', cols.sku.x + 4, y + 5, { width: cols.sku.w - 8 });
    doc.text('Cant.', cols.qty.x + 4, y + 5, { width: cols.qty.w - 8, align: 'right' });
    doc.text('Valor unitario', cols.unit.x + 4, y + 5, {
      width: cols.unit.w - 8,
      align: 'right',
    });
    doc.text('Total', cols.total.x + 4, y + 5, {
      width: cols.total.w - 8,
      align: 'right',
    });
    y += 18;

    receipt.items.forEach((item, index) => {
      const title =
        [item.brandName, item.model].filter(Boolean).join(' ') ||
        item.productName;
      const edition = item.limitedEditionNumber
        ? `Edición limitada N.º ${item.limitedEditionNumber}`
        : null;
      const rowH = edition ? 28 : 18;
      if (y + rowH > doc.page.height - 80) {
        doc.addPage();
        y = MARGIN;
      }
      if (index % 2 === 1) {
        doc.rect(MARGIN, y, contentWidth, rowH).fill(BRAND.rowAlt);
      }
      doc.rect(MARGIN, y, contentWidth, rowH).stroke(BRAND.border);
      doc.font('Helvetica').fontSize(8).fillColor(BRAND.dark);
      doc.text(title, cols.product.x + 4, y + 4, {
        width: cols.product.w - 8,
        lineBreak: false,
      });
      if (edition) {
        doc.fontSize(8).fillColor(BRAND.gray).text(edition, cols.product.x + 4, y + 14, {
          width: cols.product.w - 8,
          lineBreak: false,
        });
      }
      doc.fillColor(BRAND.dark).fontSize(8);
      doc.text(item.reference || '—', cols.ref.x + 4, y + 4, {
        width: cols.ref.w - 8,
        lineBreak: false,
      });
      doc.text(item.sku, cols.sku.x + 4, y + 4, {
        width: cols.sku.w - 8,
        lineBreak: false,
      });
      doc.text(String(item.quantity), cols.qty.x + 4, y + 4, {
        width: cols.qty.w - 8,
        align: 'right',
        lineBreak: false,
      });
      doc.text(formatCopAmount(item.unitPrice), cols.unit.x + 4, y + 4, {
        width: cols.unit.w - 8,
        align: 'right',
        lineBreak: false,
      });
      doc.text(formatCopAmount(item.lineTotal), cols.total.x + 4, y + 4, {
        width: cols.total.w - 8,
        align: 'right',
        lineBreak: false,
      });
      y += rowH;
    });

    y += 12;
    const totalsX = MARGIN + contentWidth * 0.55;
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.dark);
    doc.text('Subtotal', totalsX, y, { width: 80 });
    doc.text(formatCopAmount(receipt.subtotal), totalsX + 80, y, {
      width: contentWidth * 0.45 - 80,
      align: 'right',
    });
    y += 14;
    if (receipt.shippingCost > 0) {
      doc.text('Envío', totalsX, y, { width: 80 });
      doc.text(formatCopAmount(receipt.shippingCost), totalsX + 80, y, {
        width: contentWidth * 0.45 - 80,
        align: 'right',
      });
      y += 14;
    }
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Total', totalsX, y, { width: 80 });
    doc.text(formatCopAmount(receipt.total), totalsX + 80, y, {
      width: contentWidth * 0.45 - 80,
      align: 'right',
    });
    y += 20;

    y = this.sectionTitle(doc, 'Pagos', y);
    for (const payment of receipt.payments) {
      const label =
        payment.label ||
        PAYMENT_METHOD_LABELS[
          payment.method as keyof typeof PAYMENT_METHOD_LABELS
        ] ||
        payment.method;
      const parts = [`${label}: ${formatCopAmount(payment.amount)}`];
      if (payment.reference) parts.push(`Ref: ${payment.reference}`);
      if (payment.cardLast4) parts.push(`Tarjeta ****${payment.cardLast4}`);
      if (payment.cashReceived != null) {
        parts.push(`Recibido: ${formatCopAmount(payment.cashReceived)}`);
      }
      if (payment.changeGiven != null) {
        parts.push(`Cambio: ${formatCopAmount(payment.changeGiven)}`);
      }
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(BRAND.dark)
        .text(parts.join(' · '), MARGIN, y, { width: contentWidth });
      y += 12;
    }
    y += 8;

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(BRAND.dark)
      .text(`Vendedor: ${receipt.sellerName}`, MARGIN, y, { width: contentWidth });
    y += 18;

    y = this.sectionTitle(doc, 'Garantía', y);
    const gCols = {
      product: { x: MARGIN, w: 180 },
      duration: { x: MARGIN + 180, w: 90 },
      from: { x: MARGIN + 270, w: 90 },
      to: { x: MARGIN + 360, w: contentWidth - 360 },
    };
    doc.rect(MARGIN, y, contentWidth, 18).fill(BRAND.dark);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND.white);
    doc.text('Producto', gCols.product.x + 4, y + 5, { width: gCols.product.w - 8 });
    doc.text('Duración', gCols.duration.x + 4, y + 5, { width: gCols.duration.w - 8 });
    doc.text('Desde', gCols.from.x + 4, y + 5, { width: gCols.from.w - 8 });
    doc.text('Hasta', gCols.to.x + 4, y + 5, { width: gCols.to.w - 8 });
    y += 18;

    receipt.items.forEach((item, index) => {
      const title =
        [item.brandName, item.model].filter(Boolean).join(' ') ||
        item.productName;
      const duration =
        item.warrantyMonths <= 0
          ? 'Sin garantía'
          : item.warrantyMonths === 1
            ? '1 mes'
            : `${item.warrantyMonths} meses`;
      if (y + 18 > doc.page.height - 80) {
        doc.addPage();
        y = MARGIN;
      }
      if (index % 2 === 1) {
        doc.rect(MARGIN, y, contentWidth, 18).fill(BRAND.rowAlt);
      }
      doc.rect(MARGIN, y, contentWidth, 18).stroke(BRAND.border);
      doc.font('Helvetica').fontSize(8).fillColor(BRAND.dark);
      doc.text(title, gCols.product.x + 4, y + 5, {
        width: gCols.product.w - 8,
        lineBreak: false,
      });
      doc.text(duration, gCols.duration.x + 4, y + 5, {
        width: gCols.duration.w - 8,
        lineBreak: false,
      });
      doc.text(formatBogotaDate(item.warrantyStartsAt), gCols.from.x + 4, y + 5, {
        width: gCols.from.w - 8,
        lineBreak: false,
      });
      doc.text(
        item.warrantyEndsAt ? formatBogotaDate(item.warrantyEndsAt) : '—',
        gCols.to.x + 4,
        y + 5,
        { width: gCols.to.w - 8, lineBreak: false },
      );
      y += 18;
    });

    y += 14;
    if (y + 60 > doc.page.height - 80) {
      doc.addPage();
      y = MARGIN;
    }
    y = this.sectionTitle(doc, 'Términos de la garantía', y);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(BRAND.dark)
      .text(receipt.warrantyTerms || '', MARGIN, y, {
        width: contentWidth,
        align: 'justify',
      });
    y = doc.y + 8;

    for (const item of receipt.items) {
      if (!item.warrantyExtraTerms?.trim()) continue;
      const title =
        [item.brandName, item.model].filter(Boolean).join(' ') ||
        item.productName;
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(BRAND.dark)
        .text(`Condiciones específicas de ${title}:`, MARGIN, y, {
          width: contentWidth,
        });
      y = doc.y + 2;
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(item.warrantyExtraTerms, MARGIN, y, { width: contentWidth });
      y = doc.y + 6;
    }

    const footerNote =
      receipt.footerNote?.trim() ||
      receipt.businessSnapshot.footerNote?.trim();
    if (footerNote) {
      y += 6;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(BRAND.gray)
        .text(footerNote, MARGIN, y, { width: contentWidth });
    }

    this.addFooters(doc, receipt);

    if (receipt.voidedAt) {
      this.stampVoided(doc);
    }

    doc.end();
    return done;
  }

  private sectionTitle(
    doc: PDFKit.PDFDocument,
    title: string,
    y: number,
  ): number {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(BRAND.gold)
      .text(title.toUpperCase(), MARGIN, y);
    return y + 16;
  }

  private async tryDrawLogo(
    doc: PDFKit.PDFDocument,
    logoUrl: string | undefined,
    businessName: string,
    x: number,
    y: number,
  ): Promise<boolean> {
    if (!logoUrl?.startsWith('https://res.cloudinary.com/')) return false;
    try {
      const pngUrl = logoUrl.includes('/upload/')
        ? logoUrl.replace('/upload/', '/upload/f_png/')
        : logoUrl;
      const res = await fetch(pngUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8) return false;
      const isPng =
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47;
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
      if (!isPng && !isJpeg) return false;
      doc.image(buf, x, y, { fit: [120, 48] });
      return true;
    } catch {
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(BRAND.gold)
        .text(businessName || 'LUXTIMEE', x, y, { width: 200 });
      return true;
    }
  }

  private addFooters(doc: PDFKit.PDFDocument, receipt: ReceiptPdfInput): void {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 36;
      doc.rect(0, footerY - 6, doc.page.width, 1).fill(BRAND.gold);
      let line = `${FOOTER_NOTE} · Página ${i + 1} de ${range.count} · ${receipt.number}`;
      if (receipt.backfilled) {
        line += ` · Emitido retroactivamente el ${formatBogotaDate(receipt.issuedAt)}`;
      }
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(BRAND.gray)
        .text(line, MARGIN, footerY, {
          width: doc.page.width - MARGIN * 2,
          align: 'center',
        });
    }
  }

  private stampVoided(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const cx = doc.page.width / 2;
      const cy = doc.page.height / 2;
      doc.save();
      doc.opacity(0.25);
      doc.rotate(-35, { origin: [cx, cy] });
      doc
        .font('Helvetica-Bold')
        .fontSize(72)
        .fillColor('#B91C1C')
        .text('ANULADO', cx - 160, cy - 30, { width: 320, align: 'center' });
      doc.restore();
    }
  }
}
