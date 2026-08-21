import { Injectable } from '@nestjs/common';
import type {
  ProfitDashboardDto,
  ReportOwnerDto,
  WarrantyHistoryExportDto,
} from '@luxtime/shared';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const PERIOD_LABELS: Record<string, string> = {
  day: 'Diario',
  week: 'Semanal',
  month: 'Mensual',
};

const BRAND = {
  gold: '#B8962E',
  goldLight: '#F5E9C8',
  dark: '#1A1A1A',
  gray: '#6B7280',
  rowAlt: '#FAF7F0',
  white: '#FFFFFF',
  border: '#E5E7EB',
} as const;

const PG_MARGIN = 40;
const PG_WIDTH = 595.28;
const CONTENT_W = PG_WIDTH - PG_MARGIN * 2; // 515.28
const HEADER_H = 70;
const ROW_H = 18;

interface PdfCell {
  value: string;
  x: number;
  w: number;
  align?: 'left' | 'right' | 'center';
}

interface PdfHeaderCell extends PdfCell {
  label: string;
}

@Injectable()
export class ReportsService {
  private periodLabel(period: string) {
    return PERIOD_LABELS[period] ?? period;
  }

  private fmt(n: number): string {
    return `$${n.toLocaleString('es-CO')}`;
  }

  private fmtDate(d: string | Date): string {
    return new Date(d).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }

  private drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
    doc.rect(0, 0, PG_WIDTH, HEADER_H).fill(BRAND.dark);
    doc.rect(0, HEADER_H, PG_WIDTH, 3).fill(BRAND.gold);

    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(BRAND.gold)
      .text('LUXTIMEE', PG_MARGIN, 18, { lineBreak: false });

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(BRAND.white)
      .text(title, PG_MARGIN + 140, 16, {
        width: CONTENT_W - 140,
        align: 'right',
        lineBreak: false,
      });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#CCCCCC')
      .text(subtitle, PG_MARGIN + 140, 34, {
        width: CONTENT_W - 140,
        align: 'right',
        lineBreak: false,
      });
  }

  private drawSummaryBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
  ): void {
    doc.rect(x, y, w, h).fillAndStroke(BRAND.goldLight, BRAND.gold);
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(BRAND.gray)
      .text(label, x + 6, y + 9, { width: w - 12, align: 'center', lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(BRAND.dark)
      .text(value, x + 6, y + 22, { width: w - 12, align: 'center', lineBreak: false });
  }

  private drawTableHeaderRow(
    doc: PDFKit.PDFDocument,
    y: number,
    cols: PdfHeaderCell[],
  ): void {
    doc.rect(PG_MARGIN, y, CONTENT_W, ROW_H).fill(BRAND.dark);
    for (const col of cols) {
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(BRAND.white)
        .text(col.label, col.x + 4, y + (ROW_H - 7.5) / 2, {
          width: col.w - 8,
          align: col.align ?? 'left',
          lineBreak: false,
        });
    }
  }

  private drawTableRow(
    doc: PDFKit.PDFDocument,
    y: number,
    cells: PdfCell[],
    isAlt: boolean,
    isBold = false,
  ): void {
    if (isAlt) {
      doc.rect(PG_MARGIN, y, CONTENT_W, ROW_H).fill(BRAND.rowAlt);
    }
    doc.rect(PG_MARGIN, y, CONTENT_W, ROW_H).stroke(BRAND.border);
    for (const cell of cells) {
      doc
        .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(7.5)
        .fillColor(BRAND.dark)
        .text(cell.value, cell.x + 4, y + (ROW_H - 7.5) / 2, {
          width: cell.w - 8,
          align: cell.align ?? 'left',
          lineBreak: false,
        });
    }
  }

  private drawTotalRow(doc: PDFKit.PDFDocument, y: number, cells: PdfCell[]): void {
    doc.rect(PG_MARGIN, y, CONTENT_W, ROW_H).fillAndStroke(BRAND.goldLight, BRAND.gold);
    for (const cell of cells) {
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(BRAND.dark)
        .text(cell.value, cell.x + 4, y + (ROW_H - 7.5) / 2, {
          width: cell.w - 8,
          align: cell.align ?? 'left',
          lineBreak: false,
        });
    }
  }

  private addFooters(doc: PDFKit.PDFDocument, byLine: string): void {
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 28;
      doc.rect(0, footerY - 5, PG_WIDTH, 1).fill(BRAND.gold);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(BRAND.gray)
        .text(`${byLine} · ${new Date().toLocaleString('es-CO')}`, PG_MARGIN, footerY, {
          width: CONTENT_W / 2,
          align: 'left',
          lineBreak: false,
        });
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(BRAND.gray)
        .text(`Página ${i + 1} de ${total}`, PG_MARGIN + CONTENT_W / 2, footerY, {
          width: CONTENT_W / 2,
          align: 'right',
          lineBreak: false,
        });
    }
  }

  async buildProfitExcel(data: ProfitDashboardDto, owner: ReportOwnerDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ganancia');

    sheet.mergeCells('A1:I1');
    const title = sheet.getCell('A1');
    title.value = 'LUXTIMEE — Reporte de Ganancia';
    title.font = { bold: true, size: 14 };

    sheet.addRow(['Periodo', this.periodLabel(data.period)]);
    sheet.addRow(['Generado el', new Date().toLocaleString('es-CO')]);
    sheet.addRow(['Generado por', owner.name]);
    sheet.addRow(['Correo', owner.email]);
    sheet.addRow(['Teléfono', owner.phone ?? 'No registrado']);
    sheet.addRow(['Inversión en inventario', data.totalInventoryInvestment]);
    sheet.addRow(['Ingresos por relojes', data.totalRevenue]);
    sheet.addRow(['Fondo de domicilios', data.totalShippingRevenue]);
    sheet.addRow(['Ganancia bruta', data.totalGrossProfit]);
    sheet.addRow(['Comisión secretaría', data.totalCommission]);
    sheet.addRow(['Ganancia neta', data.totalProfit]);
    sheet.addRow([`Fondo reinversión (${data.reinvestmentPercent}%)`, data.totalReinvestmentFund]);
    sheet.addRow([`Ganancia libre dueño (${data.ownerProfitPercent}%)`, data.totalOwnerProfit]);
    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'Pedido',
      'Tipo',
      'Estado',
      'Producto',
      'Cantidad',
      'Ingreso',
      'Costo',
      'Ganancia',
      'Comisión',
    ]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE3C7' } };
    });

    const orderTypeLabels: Record<string, string> = {
      DETAL: 'Al detal',
      MAYORISTA: 'Mayorista',
    };
    const orderStatusLabels: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      PAGADO: 'Pagado',
      ENVIADO: 'Enviado',
      ENTREGADO: 'Entregado',
    };

    data.items.forEach((item) => {
      sheet.addRow([
        item.readableId,
        orderTypeLabels[item.orderType] ?? item.orderType,
        orderStatusLabels[item.orderStatus] ?? item.orderStatus,
        item.productName,
        item.quantity,
        item.revenue,
        item.cost,
        item.profit,
        item.commission,
      ]);
    });

    sheet.addRow([]);
    const totalRow = sheet.addRow([
      '',
      '',
      '',
      'TOTAL',
      '',
      data.totalRevenue,
      data.totalCost,
      data.totalProfit,
      data.totalCommission,
    ]);
    totalRow.font = { bold: true };

    if (data.shippingItems.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['Fondo de domicilios (vehículo de entregas)']).font = { bold: true };
      const shippingHeader = sheet.addRow(['Pedido', 'Tipo', 'Estado', 'Zona', 'Domicilio', 'Fecha']);
      shippingHeader.font = { bold: true };
      for (const item of data.shippingItems) {
        sheet.addRow([
          item.readableId,
          orderTypeLabels[item.orderType] ?? item.orderType,
          orderStatusLabels[item.orderStatus] ?? item.orderStatus,
          item.shippingZoneName ?? 'Sin zona',
          item.shippingCost,
          item.paidAt ? new Date(item.paidAt).toLocaleDateString('es-CO') : '',
        ]);
      }
      sheet.addRow(['', '', '', 'TOTAL', data.totalShippingRevenue, '']).font = { bold: true };
    }

    sheet.columns.forEach((col, index) => {
      col.width = index === 3 ? 32 : 18;
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildProfitPdf(data: ProfitDashboardDto, owner: ReportOwnerDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: PG_MARGIN, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const periodLbl = this.periodLabel(data.period);
      const today = new Date().toLocaleDateString('es-CO');

      this.drawHeader(doc, 'Reporte de Ganancias', `Periodo: ${periodLbl} · ${today}`);

      // Summary cards — row 1
      const totalOrders = data.items.length;
      const wholesaleOrders = data.items.filter((i) => i.orderType === 'MAYORISTA').length;
      const avgValue = totalOrders > 0 ? Math.round(data.totalRevenue / totalOrders) : 0;
      const CARD_H = 46;
      const cardW1 = (CONTENT_W - 12) / 4;
      let cy = HEADER_H + 14;

      this.drawSummaryBox(doc, PG_MARGIN, cy, cardW1, CARD_H, 'Total Ingresos', this.fmt(data.totalRevenue));
      this.drawSummaryBox(doc, PG_MARGIN + (cardW1 + 4) * 1, cy, cardW1, CARD_H, 'Pedidos', `${totalOrders}`);
      this.drawSummaryBox(doc, PG_MARGIN + (cardW1 + 4) * 2, cy, cardW1, CARD_H, 'Mayoristas', `${wholesaleOrders}`);
      this.drawSummaryBox(doc, PG_MARGIN + (cardW1 + 4) * 3, cy, cardW1, CARD_H, 'Valor Promedio', this.fmt(avgValue));
      cy += CARD_H + 6;

      // Summary cards — row 2
      const cardW2 = (CONTENT_W - 8) / 3;
      this.drawSummaryBox(doc, PG_MARGIN, cy, cardW2, CARD_H, 'Ganancia Bruta', this.fmt(data.totalGrossProfit));
      this.drawSummaryBox(doc, PG_MARGIN + (cardW2 + 4) * 1, cy, cardW2, CARD_H, 'Ganancia Neta', this.fmt(data.totalProfit));
      this.drawSummaryBox(doc, PG_MARGIN + (cardW2 + 4) * 2, cy, cardW2, CARD_H, 'Comisión Secretaría', this.fmt(data.totalCommission));
      cy += CARD_H + 6;

      this.drawSummaryBox(doc, PG_MARGIN, cy, CONTENT_W, 36, 'Fondo de domicilios', this.fmt(data.totalShippingRevenue));
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(BRAND.gray)
        .text('Separado de ganancias de relojes · destinado a gastos del vehículo de entregas', PG_MARGIN + 8, cy + 22, {
          width: CONTENT_W - 16,
          lineBreak: false,
        });
      cy += 44;

      // Column definitions
      const cols: PdfHeaderCell[] = [
        { label: 'Fecha',    value: '', x: PG_MARGIN,        w: 65,    align: 'left' },
        { label: 'Pedido',   value: '', x: PG_MARGIN + 65,   w: 55,    align: 'left' },
        { label: 'Producto', value: '', x: PG_MARGIN + 120,  w: 150,   align: 'left' },
        { label: 'Tipo',     value: '', x: PG_MARGIN + 270,  w: 50,    align: 'left' },
        { label: 'Cant.',    value: '', x: PG_MARGIN + 320,  w: 30,    align: 'center' },
        { label: 'Ingreso',  value: '', x: PG_MARGIN + 350,  w: 82.64, align: 'right' },
        { label: 'Ganancia', value: '', x: PG_MARGIN + 432.64, w: 82.64, align: 'right' },
      ];

      const orderTypeLabels: Record<string, string> = {
        DETAL: 'Al detal',
        MAYORISTA: 'Mayor.',
      };

      let tableY = cy;
      this.drawTableHeaderRow(doc, tableY, cols);
      tableY += ROW_H;

      if (data.items.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(BRAND.gray)
          .text('Sin ventas registradas en el periodo seleccionado.', PG_MARGIN, tableY + 8, {
            width: CONTENT_W,
            align: 'center',
            lineBreak: false,
          });
        tableY += ROW_H + 8;
      } else {
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          if (tableY + ROW_H > doc.page.height - 50) {
            doc.addPage();
            tableY = PG_MARGIN;
            this.drawTableHeaderRow(doc, tableY, cols);
            tableY += ROW_H;
          }
          const cells: PdfCell[] = [
            { value: item.paidAt ? this.fmtDate(item.paidAt) : '—', x: cols[0].x, w: cols[0].w, align: 'left' },
            { value: item.readableId,                                 x: cols[1].x, w: cols[1].w, align: 'left' },
            { value: item.productName,                                x: cols[2].x, w: cols[2].w, align: 'left' },
            { value: orderTypeLabels[item.orderType] ?? item.orderType, x: cols[3].x, w: cols[3].w, align: 'left' },
            { value: String(item.quantity),                           x: cols[4].x, w: cols[4].w, align: 'center' },
            { value: this.fmt(item.revenue),                          x: cols[5].x, w: cols[5].w, align: 'right' },
            { value: this.fmt(item.profit),                           x: cols[6].x, w: cols[6].w, align: 'right' },
          ];
          this.drawTableRow(doc, tableY, cells, idx % 2 === 1);
          tableY += ROW_H;
        }

        // Grand total row
        if (tableY + ROW_H > doc.page.height - 50) {
          doc.addPage();
          tableY = PG_MARGIN;
        }
        const totalCells: PdfCell[] = [
          { value: '',                          x: cols[0].x, w: cols[0].w, align: 'left' },
          { value: '',                          x: cols[1].x, w: cols[1].w, align: 'left' },
          { value: '',                          x: cols[2].x, w: cols[2].w, align: 'left' },
          { value: 'TOTAL',                     x: cols[3].x, w: cols[3].w + cols[4].w, align: 'right' },
          { value: '',                          x: cols[4].x, w: 0, align: 'left' },
          { value: this.fmt(data.totalRevenue), x: cols[5].x, w: cols[5].w, align: 'right' },
          { value: this.fmt(data.totalProfit),  x: cols[6].x, w: cols[6].w, align: 'right' },
        ];
        this.drawTotalRow(doc, tableY, totalCells);
        tableY += ROW_H + 10;
      }

      if (data.shippingItems.length > 0) {
        if (tableY + ROW_H * 3 > doc.page.height - 50) {
          doc.addPage();
          tableY = PG_MARGIN;
        }
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(BRAND.dark)
          .text('Fondo de domicilios (vehículo de entregas)', PG_MARGIN, tableY, { width: CONTENT_W, lineBreak: false });
        tableY += 14;

        const shipCols: PdfHeaderCell[] = [
          { label: 'Fecha', value: '', x: PG_MARGIN, w: 65, align: 'left' },
          { label: 'Pedido', value: '', x: PG_MARGIN + 65, w: 70, align: 'left' },
          { label: 'Zona', value: '', x: PG_MARGIN + 135, w: 120, align: 'left' },
          { label: 'Domicilio', value: '', x: PG_MARGIN + 255, w: CONTENT_W - 255, align: 'right' },
        ];
        this.drawTableHeaderRow(doc, tableY, shipCols);
        tableY += ROW_H;

        for (let idx = 0; idx < data.shippingItems.length; idx++) {
          const item = data.shippingItems[idx];
          if (tableY + ROW_H > doc.page.height - 50) {
            doc.addPage();
            tableY = PG_MARGIN;
            this.drawTableHeaderRow(doc, tableY, shipCols);
            tableY += ROW_H;
          }
          const cells: PdfCell[] = [
            { value: this.fmtDate(item.paidAt), x: shipCols[0].x, w: shipCols[0].w, align: 'left' },
            { value: item.readableId, x: shipCols[1].x, w: shipCols[1].w, align: 'left' },
            { value: item.shippingZoneName ?? 'Sin zona', x: shipCols[2].x, w: shipCols[2].w, align: 'left' },
            { value: this.fmt(item.shippingCost), x: shipCols[3].x, w: shipCols[3].w, align: 'right' },
          ];
          this.drawTableRow(doc, tableY, cells, idx % 2 === 1);
          tableY += ROW_H;
        }

        const shipTotal: PdfCell[] = [
          { value: '', x: shipCols[0].x, w: shipCols[0].w, align: 'left' },
          { value: '', x: shipCols[1].x, w: shipCols[1].w, align: 'left' },
          { value: 'TOTAL', x: shipCols[2].x, w: shipCols[2].w, align: 'right' },
          { value: this.fmt(data.totalShippingRevenue), x: shipCols[3].x, w: shipCols[3].w, align: 'right' },
        ];
        this.drawTotalRow(doc, tableY, shipTotal);
        tableY += ROW_H + 10;
      }

      // Breakdown footnote
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(BRAND.gray)
        .text(
          `Reinversión (${data.reinvestmentPercent}%): ${this.fmt(data.totalReinvestmentFund)}   ·   ` +
            `Ganancia dueño (${data.ownerProfitPercent}%): ${this.fmt(data.totalOwnerProfit)}   ·   ` +
            `Inversión inventario: ${this.fmt(data.totalInventoryInvestment)}`,
          PG_MARGIN,
          tableY,
          { width: CONTENT_W, align: 'left', lineBreak: false },
        );

      this.addFooters(doc, `${owner.name} · ${owner.email}`);
      doc.flushPages();
      doc.end();
    });
  }

  async buildWarrantyExcel(data: WarrantyHistoryExportDto, owner: ReportOwnerDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Garantías');

    sheet.mergeCells('A1:J1');
    const title = sheet.getCell('A1');
    title.value = 'LUXTIMEE — Historias de garantías';
    title.font = { bold: true, size: 14 };

    sheet.addRow(['Periodo', data.periodLabel]);
    sheet.addRow(['Generado el', new Date().toLocaleString('es-CO')]);
    sheet.addRow(['Generado por', owner.name]);
    sheet.addRow(['Correo', owner.email]);
    sheet.addRow(['Teléfono', owner.phone ?? 'No registrado']);
    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'SKU',
      'Producto',
      'Cliente',
      'Teléfono',
      'Dirección',
      'Fecha venta',
      'Fecha garantía',
      'Daño',
      'Reemplazo',
      'Estado',
    ]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE3C7' } };
    });

    data.items.forEach((item) => {
      sheet.addRow([
        item.productSku,
        item.productName,
        item.customerName,
        item.customerPhone ?? '',
        item.customerAddress,
        new Date(item.saleDate).toLocaleString('es-CO'),
        item.serviceDate ? new Date(item.serviceDate).toLocaleString('es-CO') : '',
        item.damageDescription ?? '',
        item.replacementType === 'OTHER_WATCH'
          ? `Otro (${item.replacementSku ?? ''})`
          : item.replacementType === 'SAME_WATCH'
            ? 'Mismo reloj'
            : '',
        item.status === 'GARANTIA_REGISTRADA' ? 'Registrada' : 'Pendiente',
      ]);
    });

    sheet.columns.forEach((col, index) => {
      col.width = index === 1 || index === 7 ? 32 : 18;
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildWarrantyPdf(data: WarrantyHistoryExportDto, owner: ReportOwnerDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: PG_MARGIN, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const today = new Date().toLocaleDateString('es-CO');
      this.drawHeader(doc, 'Reporte de Garantías', `Periodo: ${data.periodLabel} · ${today}`);

      // Summary cards
      const total = data.items.length;
      const registered = data.items.filter((i) => i.status === 'GARANTIA_REGISTRADA').length;
      const CARD_H = 46;
      const cardW = (CONTENT_W - 4) / 2;
      let cy = HEADER_H + 14;

      this.drawSummaryBox(doc, PG_MARGIN, cy, cardW, CARD_H, 'Total Garantías Registradas', `${total}`);
      this.drawSummaryBox(doc, PG_MARGIN + cardW + 4, cy, cardW, CARD_H, 'Garantías Activas (Registradas)', `${registered}`);
      cy += CARD_H + 12;

      // Column definitions
      const cols: PdfHeaderCell[] = [
        { label: 'Registro',  value: '', x: PG_MARGIN,        w: 72,    align: 'left' },
        { label: 'Cliente',   value: '', x: PG_MARGIN + 72,   w: 110,   align: 'left' },
        { label: 'Producto',  value: '', x: PG_MARGIN + 182,  w: 143,   align: 'left' },
        { label: 'SKU',       value: '', x: PG_MARGIN + 325,  w: 75,    align: 'left' },
        { label: 'Serv.',     value: '', x: PG_MARGIN + 400,  w: 65,    align: 'left' },
        { label: 'Estado',    value: '', x: PG_MARGIN + 465,  w: 50.28, align: 'center' },
      ];

      let tableY = cy;
      this.drawTableHeaderRow(doc, tableY, cols);
      tableY += ROW_H;

      if (data.items.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(BRAND.gray)
          .text('Sin historias de garantía en el periodo seleccionado.', PG_MARGIN, tableY + 8, {
            width: CONTENT_W,
            align: 'center',
            lineBreak: false,
          });
      } else {
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          if (tableY + ROW_H > doc.page.height - 50) {
            doc.addPage();
            tableY = PG_MARGIN;
            this.drawTableHeaderRow(doc, tableY, cols);
            tableY += ROW_H;
          }
          const statusLabel = item.status === 'GARANTIA_REGISTRADA' ? 'Reg.' : 'Pend.';
          const cells: PdfCell[] = [
            { value: this.fmtDate(item.createdAt),                              x: cols[0].x, w: cols[0].w, align: 'left' },
            { value: item.customerName,                                          x: cols[1].x, w: cols[1].w, align: 'left' },
            { value: item.productName,                                           x: cols[2].x, w: cols[2].w, align: 'left' },
            { value: item.productSku,                                            x: cols[3].x, w: cols[3].w, align: 'left' },
            { value: item.serviceDate ? this.fmtDate(item.serviceDate) : '—',   x: cols[4].x, w: cols[4].w, align: 'left' },
            { value: statusLabel,                                                x: cols[5].x, w: cols[5].w, align: 'center' },
          ];
          this.drawTableRow(doc, tableY, cells, idx % 2 === 1);
          tableY += ROW_H;
        }
      }

      this.addFooters(doc, `${owner.name} · ${owner.email}`);
      doc.flushPages();
      doc.end();
    });
  }
}
