import { formatCopAmount, type PosCashClosingDto } from '@luxtime/shared';
import PDFDocument from 'pdfkit';

const MARGIN = 48;

function line(label: string, value: string) {
  return { label, value };
}

export function renderCashClosingPdf(closing: PosCashClosingDto): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: MARGIN,
    compress: false,
    info: {
      Title: `Cierre de caja ${closing.businessDate}`,
      Author: 'LUXTIMEE',
    },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fillColor('#1A1A1A').fontSize(18).text('LUXTIMEE', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(13).fillColor('#B8962E').text('Cierre de caja');
  doc.moveDown(0.6);
  doc.fillColor('#1A1A1A').fontSize(11);

  const rows = [
    line('Fecha', closing.businessDate),
    line('Cerró', closing.userName || closing.userId),
    line('Apertura', formatCopAmount(closing.openingCash)),
    line('Ventas efectivo', formatCopAmount(closing.totalCash)),
    line('Transferencias', formatCopAmount(closing.totalTransfer)),
    line('Datáfono', formatCopAmount(closing.totalCard)),
    line('Otros', formatCopAmount(closing.totalOther)),
    line('Total ventas', `${formatCopAmount(closing.totalSales)} (${closing.salesCount})`),
    line('Salidas de caja', formatCopAmount(closing.cashOutTotal)),
    line('Esperado', formatCopAmount(closing.expectedCash)),
    line('Contado', formatCopAmount(closing.countedCash)),
    line('Diferencia', formatCopAmount(closing.difference)),
  ];

  for (const row of rows) {
    doc.font('Helvetica').text(row.label, { continued: true, width: 180 });
    doc.font('Helvetica-Bold').text(`  ${row.value}`);
  }

  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(11).text('Notas');
  doc.font('Helvetica').fontSize(10).fillColor('#374151').text(closing.notes?.trim() || '—', {
    width: doc.page.width - MARGIN * 2,
  });
  doc.moveDown(1);
  doc.fontSize(8).fillColor('#6B7280').text(
    'Las ventas anuladas y las salidas registradas después del cierre no modifican este documento.',
    { width: doc.page.width - MARGIN * 2 },
  );

  doc.end();
  return done;
}
