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

@Injectable()
export class ReportsService {
  private periodLabel(period: string) {
    return PERIOD_LABELS[period] ?? period;
  }

  async buildProfitExcel(data: ProfitDashboardDto, owner: ReportOwnerDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ganancia');

    sheet.mergeCells('A1:I1');
    const title = sheet.getCell('A1');
    title.value = 'Luxtime — Reporte de Ganancia';
    title.font = { bold: true, size: 14 };

    sheet.addRow(['Periodo', this.periodLabel(data.period)]);
    sheet.addRow(['Generado el', new Date().toLocaleString('es-CO')]);
    sheet.addRow(['Generado por', owner.name]);
    sheet.addRow(['Correo', owner.email]);
    sheet.addRow(['Teléfono', owner.phone ?? 'No registrado']);
    sheet.addRow(['Inversión en inventario', data.totalInventoryInvestment]);
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

    sheet.columns.forEach((col, index) => {
      col.width = index === 3 ? 32 : 18;
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildProfitPdf(data: ProfitDashboardDto, owner: ReportOwnerDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).fillColor('#000000').text('Luxtime — Reporte de Ganancia', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(9).fillColor('#666666');
      doc.text(`Generado el ${new Date().toLocaleString('es-CO')}`);
      doc.text(`Generado por: ${owner.name} · ${owner.email}${owner.phone ? ` · ${owner.phone}` : ''}`);
      doc.fillColor('#000000');
      doc.moveDown();

      doc.fontSize(12).text(`Periodo: ${this.periodLabel(data.period)}`);
      doc.text(`Ingresos: $${data.totalRevenue.toLocaleString('es-CO')}`);
      doc.text(`Costos vendidos: $${data.totalCost.toLocaleString('es-CO')}`);
      doc.text(`Ganancia bruta: $${data.totalGrossProfit.toLocaleString('es-CO')}`);
      doc.text(`Comisión secretaría: $${data.totalCommission.toLocaleString('es-CO')}`);
      doc.text(`Ganancia neta: $${data.totalProfit.toLocaleString('es-CO')}`);
      doc.text(`Fondo reinversión (${data.reinvestmentPercent}%): $${data.totalReinvestmentFund.toLocaleString('es-CO')}`);
      doc.text(`Ganancia libre dueño (${data.ownerProfitPercent}%): $${data.totalOwnerProfit.toLocaleString('es-CO')}`);
      doc.text(`Inversión en inventario: $${data.totalInventoryInvestment.toLocaleString('es-CO')}`);
      doc.moveDown();

      if (!data.items.length) {
        doc.fontSize(11).fillColor('#666666').text('Sin ventas registradas en el periodo seleccionado.');
      } else {
        data.items.forEach((item) => {
          doc
            .fontSize(10)
            .fillColor('#000000')
            .text(`${item.readableId} · ${item.productName} x${item.quantity} → $${item.profit.toLocaleString('es-CO')}`);
        });
      }

      doc.end();
    });
  }

  async buildWarrantyExcel(data: WarrantyHistoryExportDto, owner: ReportOwnerDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Garantías');

    sheet.mergeCells('A1:J1');
    const title = sheet.getCell('A1');
    title.value = 'Luxtime — Historias de garantías';
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
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).fillColor('#000000').text('Luxtime — Historias de garantías', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666666');
      doc.text(`Generado el ${new Date().toLocaleString('es-CO')}`);
      doc.text(`Generado por: ${owner.name} · ${owner.email}${owner.phone ? ` · ${owner.phone}` : ''}`);
      doc.fillColor('#000000');
      doc.moveDown();
      doc.fontSize(12).text(`Periodo: ${data.periodLabel}`);
      doc.moveDown();

      if (!data.items.length) {
        doc.fontSize(11).fillColor('#666666').text('Sin historias de garantía en el periodo seleccionado.');
      } else {
        data.items.forEach((item) => {
          doc
            .fontSize(10)
            .fillColor('#000000')
            .text(
              `${item.productSku} · ${item.customerName} · Venta ${new Date(item.saleDate).toLocaleDateString('es-CO')}${
                item.serviceDate
                  ? ` · Garantía ${new Date(item.serviceDate).toLocaleDateString('es-CO')}`
                  : ' · Pendiente'
              }`,
            );
        });
      }

      doc.end();
    });
  }
}
