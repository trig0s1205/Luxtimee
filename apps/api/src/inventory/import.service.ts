import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slug.util';
import { generateSku } from '../watches/utils/sku.util';

@Injectable()
export class InventoryImportService {
  constructor(private prisma: PrismaService) {}

  async parseAndImport(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no contiene hojas');

    const errors: Array<{ row: number; message: string }> = [];
    let imported = 0;

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const brandName = String(row.getCell(1).value ?? '').trim();
      const model = String(row.getCell(2).value ?? '').trim();
      const movementType = String(row.getCell(3).value ?? '').trim();
      const retailPrice = Number(row.getCell(4).value ?? 0);
      const wholesalePrice = Number(row.getCell(5).value ?? 0);
      const stock = Number(row.getCell(6).value ?? 0);

      if (!brandName && !model) continue;
      if (!brandName || !model || !movementType || !retailPrice) {
        errors.push({ row: rowNumber, message: 'Faltan campos obligatorios' });
        continue;
      }

      try {
        const brandSlug = slugify(brandName);
        const brand = await this.prisma.brand.upsert({
          where: { slug: brandSlug },
          update: { name: brandName },
          create: { name: brandName, slug: brandSlug },
        });
        const existing = await this.prisma.watch.findFirst({
          where: { brandId: brand.id, model, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        const sku = await this.ensureUniqueSku(generateSku(brand.name, model));
        const watchSlug = await this.ensureUniqueSlug(slugify(`${brandSlug}-${model}`), existing?.id);

        await this.prisma.watch.upsert({
          where: { slug: watchSlug },
          update: {
            movementType,
            retailPrice,
            wholesalePrice: wholesalePrice || Math.round(retailPrice * 0.88),
            stock,
            isActive: true,
          },
          create: {
            sku,
            brand: { connect: { id: brand.id } },
            model,
            slug: watchSlug,
            movementType,
            retailPrice,
            wholesalePrice: wholesalePrice || Math.round(retailPrice * 0.88),
            stock,
          },
        });
        imported++;
      } catch (e) {
        errors.push({ row: rowNumber, message: e instanceof Error ? e.message : 'Error desconocido' });
      }
    }

    return { imported, errors };
  }

  private async ensureUniqueSku(sku: string) {
    let candidate = sku;
    let suffix = 1;
    while (await this.prisma.watch.findUnique({ where: { sku: candidate } })) {
      candidate = `${sku}-${suffix.toString(36).toUpperCase()}`;
      suffix++;
    }
    return candidate;
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string) {
    let candidate = slug;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.watch.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${slug}-${suffix.toString(36).toUpperCase()}`;
      suffix++;
    }
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario');
    sheet.addRow(['Marca', 'Modelo', 'Movimiento', 'Precio detal', 'Precio mayorista', 'Stock']);
    sheet.addRow(['Rolex', 'Submariner Date', 'Automático', 18500000, 16200000, 2]);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
