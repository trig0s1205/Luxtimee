import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { watch: { include: { brand: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => ({
      id: item.id,
      watchId: item.watchId,
      createdAt: item.createdAt.toISOString(),
      watch: {
        id: item.watch.id,
        slug: item.watch.slug,
        model: item.watch.model,
        brand: item.watch.brand,
        retailPrice: item.watch.retailPrice,
        frontImageUrl: item.watch.frontImageUrl,
        stock: item.watch.stock,
      },
    }));
  }

  async add(userId: string, watchId: string) {
    const watch = await this.prisma.watch.findFirst({ where: { id: watchId, isActive: true } });
    if (!watch) throw new NotFoundException('Reloj no encontrado');
    return this.prisma.wishlistItem.upsert({
      where: { userId_watchId: { userId, watchId } },
      update: {},
      create: { userId, watchId },
    });
  }

  async remove(userId: string, watchId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, watchId } });
    return { ok: true };
  }
}
