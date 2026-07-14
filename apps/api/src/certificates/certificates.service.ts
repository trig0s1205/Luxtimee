import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slug.util';

@Injectable()
export class CertificatesService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async generateForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            watch: { include: { warrantyTemplate: true, brand: true } },
          },
        },
      },
    });
    if (!order?.paidAt) return [];

    const siteUrl = this.config.get('FRONTEND_URL') ?? 'http://localhost:3000';
    const created = [];

    for (const item of order.items) {
      for (let unit = 0; unit < item.quantity; unit++) {
        const slug = slugify(`${order.readableId}-${item.productRef}-${unit + 1}-${Date.now()}`);
        const publicUrl = `${siteUrl}/certificado/${slug}`;
        const qrPayload = await QRCode.toDataURL(publicUrl);
        const certificate = await this.prisma.certificate.create({
          data: {
            orderItemId: item.id,
            watchId: item.watchId,
            slug,
            qrPayload,
            warrantySnapshot: item.watch.warrantyTemplate ?? {},
          },
        });
        created.push(certificate);
      }
    }
    return created;
  }

  async findPublicBySlug(slug: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { slug },
      include: {
        watch: { include: { brand: true } },
        orderItem: {
          include: {
            order: { select: { customerName: true, paidAt: true, readableId: true } },
          },
        },
      },
    });
    if (!cert) return null;
    return {
      slug: cert.slug,
      qrPayload: cert.qrPayload,
      issuedAt: cert.issuedAt.toISOString(),
      customerName: cert.orderItem.order.customerName,
      orderReadableId: cert.orderItem.order.readableId,
      paidAt: cert.orderItem.order.paidAt?.toISOString(),
      watch: {
        brand: cert.watch.brand.name,
        model: cert.watch.model,
        image: cert.watch.frontImageUrl,
      },
      warranty: cert.warrantySnapshot,
    };
  }
}
