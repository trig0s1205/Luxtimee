import { Injectable } from '@nestjs/common';
import type { ProfitDashboardDto } from '@luxtime/shared';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportsService {
  async buildProfitExcel(data: ProfitDashboardDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ganancia');
    sheet.columns = [
      { header: 'Pedido', key: 'readableId', width: 18 },
      { header: 'Producto', key: 'productName', width: 30 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'Ingreso', key: 'revenue', width: 14 },
      { header: 'Costo', key: 'cost', width: 14 },
      { header: 'Ganancia', key: 'profit', width: 14 },
      { header: 'Comisión', key: 'commission', width: 12 },
    ];
    data.items.forEach((item) => sheet.addRow(item));
    sheet.addRow({});
    sheet.addRow({
      productName: 'TOTAL',
      revenue: data.totalRevenue,
      cost: data.totalCost,
      profit: data.totalProfit,
      commission: data.totalCommission,
    });
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildProfitPdf(data: ProfitDashboardDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Luxtime — Reporte de Ganancia', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Periodo: ${data.period}`);
      doc.text(`Ingresos: $${data.totalRevenue.toLocaleString('es-CO')}`);
      doc.text(`Costos: $${data.totalCost.toLocaleString('es-CO')}`);
      doc.text(`Ganancia: $${data.totalProfit.toLocaleString('es-CO')}`);
      doc.text(`Comisión secretaria: $${data.totalCommission.toLocaleString('es-CO')}`);
      doc.moveDown();
      data.items.slice(0, 40).forEach((item) => {
        doc.text(`${item.readableId} · ${item.productName} x${item.quantity} → $${item.profit.toLocaleString('es-CO')}`);
      });
      doc.end();
    });
  }
}
