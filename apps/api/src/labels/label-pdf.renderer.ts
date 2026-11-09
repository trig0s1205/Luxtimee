import { Injectable } from '@nestjs/common';
import { formatCopAmount } from '@luxtime/shared';
import PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import {
  SHEET,
  THERMAL,
  sheetSlots,
  thermalSlots,
  type LabelLayout,
} from './label-layout.util';

export type LabelWatch = {
  id: string;
  sku: string;
  brandName: string;
  model: string;
  retailPrice: number;
};

export type LabelPdfOptions = {
  layout: LabelLayout;
  includePrice?: boolean;
  startPosition?: number;
  offsetXmm?: number;
  offsetYmm?: number;
  compress?: boolean;
};

@Injectable()
export class LabelPdfRenderer {
  async render(
    watchesInOrder: LabelWatch[],
    options: LabelPdfOptions,
  ): Promise<Buffer> {
    const barcodeCache = new Map<string, Buffer>();
    const isSheet = options.layout === 'SHEET_LETTER_3X10';
    const slots = isSheet
      ? sheetSlots(
          watchesInOrder.length,
          options.startPosition ?? 1,
          options.offsetXmm ?? 0,
          options.offsetYmm ?? 0,
        )
      : thermalSlots(
          watchesInOrder.length,
          options.offsetXmm ?? 0,
          options.offsetYmm ?? 0,
        );

    const pageSize = isSheet
      ? { width: SHEET.pageWidth, height: SHEET.pageHeight }
      : { width: THERMAL.pageWidth, height: THERMAL.pageHeight };

    const doc = new PDFDocument({
      size: [pageSize.width, pageSize.height],
      margin: 0,
      autoFirstPage: false,
      compress: options.compress !== false,
      info: { Title: 'Etiquetas Luxtimee' },
    });

    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    let currentPage = -1;
    for (let i = 0; i < watchesInOrder.length; i++) {
      const watch = watchesInOrder[i];
      const slot = slots[i];
      if (slot.page !== currentPage) {
        doc.addPage({ size: [pageSize.width, pageSize.height], margin: 0 });
        currentPage = slot.page;
      }
      const png = await this.barcodePng(watch.sku, barcodeCache);
      this.drawLabel(doc, watch, slot.x, slot.y, png, {
        isSheet,
        includePrice: options.includePrice === true,
      });
    }

    doc.end();
    return done;
  }

  private async barcodePng(
    sku: string,
    cache: Map<string, Buffer>,
  ): Promise<Buffer> {
    const hit = cache.get(sku);
    if (hit) return hit;
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: sku,
      scale: 4,
      height: 10,
      includetext: false,
      paddingwidth: 10,
      paddingheight: 0,
      backgroundcolor: 'FFFFFF',
    });
    const buf = Buffer.from(png);
    cache.set(sku, buf);
    return buf;
  }

  private drawLabel(
    doc: PDFKit.PDFDocument,
    watch: LabelWatch,
    x: number,
    y: number,
    barcode: Buffer,
    opts: { isSheet: boolean; includePrice: boolean },
  ) {
    const pad = opts.isSheet ? 6 : 4;
    const labelW = opts.isSheet ? SHEET.labelW : THERMAL.pageWidth;
    const labelH = opts.isSheet ? SHEET.labelH : THERMAL.pageHeight;
    const innerW = labelW - pad * 2;
    const titleSize = opts.isSheet ? 7 : 6.5;
    const skuSize = opts.isSheet ? 9 : 8.5;

    const brand = (watch.brandName || '').toUpperCase();
    const title = `${brand} · ${watch.model}`.trim();
    doc.font('Helvetica-Bold').fontSize(titleSize).fillColor('#000000');
    let line = title;
    while (doc.widthOfString(line) > innerW && line.length > 1) {
      line = `${line.slice(0, -2)}…`;
    }
    const titleY = y + pad;
    doc.text(line, x + pad, titleY, {
      width: innerW,
      align: 'center',
      lineBreak: false,
    });

    const barcodeTop = titleY + titleSize + 2;
    const barcodeMaxH = 30;
    doc.image(barcode, x + pad, barcodeTop, {
      fit: [innerW, barcodeMaxH],
      align: 'center',
    });

    const skuY = y + labelH - pad - skuSize;
    doc.font('Helvetica-Bold').fontSize(skuSize).fillColor('#000000');
    if (opts.includePrice) {
      doc.text(watch.sku, x + pad, skuY, {
        width: innerW * 0.55,
        align: 'left',
        lineBreak: false,
      });
      doc.font('Helvetica').fontSize(skuSize - 0.5);
      doc.text(formatCopAmount(watch.retailPrice), x + pad, skuY, {
        width: innerW,
        align: 'right',
        lineBreak: false,
      });
    } else {
      doc.text(watch.sku, x + pad, skuY, {
        width: innerW,
        align: 'center',
        lineBreak: false,
      });
    }
  }
}
