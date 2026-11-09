import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { bogotaDateParts } from '../receipts/bogota-time.util';
import { expandLabelItems } from './label-layout.util';
import { LabelPdfRenderer } from './label-pdf.renderer';
import type { LabelsPdfDto } from './dto/labels.dto';

@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: LabelPdfRenderer,
  ) {}

  async lookup(watchIds: string[]) {
    const watches = await this.prisma.watch.findMany({
      where: { id: { in: watchIds }, deletedAt: null },
      select: {
        id: true,
        sku: true,
        model: true,
        reference: true,
        stock: true,
        retailPrice: true,
        frontImageUrl: true,
        primaryImageUrl: true,
        images: true,
        mainImageIndex: true,
        brand: { select: { name: true } },
      },
    });
    const byId = new Map(watches.map((w) => [w.id, w]));
    return watchIds
      .map((id) => byId.get(id))
      .filter((w): w is NonNullable<typeof w> => Boolean(w))
      .map((w) => ({
        id: w.id,
        sku: w.sku,
        brandName: w.brand.name,
        model: w.model,
        reference: w.reference,
        stock: w.stock,
        retailPrice: w.retailPrice,
        imageUrl:
          w.frontImageUrl ??
          w.primaryImageUrl ??
          w.images[w.mainImageIndex] ??
          w.images[0] ??
          null,
      }));
  }

  async buildPdf(dto: LabelsPdfDto): Promise<{ filename: string; buffer: Buffer }> {
    const expanded = expandLabelItems(dto.items);
    const watchIds = [...new Set(expanded.map((e) => e.watchId))];
    const watches = await this.prisma.watch.findMany({
      where: { id: { in: watchIds }, deletedAt: null },
      select: {
        id: true,
        sku: true,
        model: true,
        retailPrice: true,
        brand: { select: { name: true } },
      },
    });
    const byId = new Map(
      watches.map((w) => [
        w.id,
        {
          id: w.id,
          sku: w.sku,
          brandName: w.brand.name,
          model: w.model,
          retailPrice: w.retailPrice,
        },
      ]),
    );
    for (const id of watchIds) {
      if (!byId.has(id)) {
        throw new BadRequestException('Reloj no encontrado');
      }
    }
    const ordered = expanded.map((e) => byId.get(e.watchId)!);
    const buffer = await this.renderer.render(ordered, {
      layout: dto.layout,
      includePrice: dto.includePrice,
      startPosition: dto.startPosition,
      offsetXmm: dto.offsetXmm,
      offsetYmm: dto.offsetYmm,
    });
    const now = new Date();
    const parts = bogotaDateParts(now);
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const ymd = `${parts.year}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`;
    const hm = time.replace(':', '');
    return { filename: `Etiquetas-${ymd}-${hm}.pdf`, buffer };
  }
}
