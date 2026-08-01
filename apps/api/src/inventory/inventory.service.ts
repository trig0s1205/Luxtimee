import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStockDto } from '../products/dto/watch.dto';
import { WaitlistService } from '../waitlist/waitlist.service';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private prisma: PrismaService,
    private waitlistService: WaitlistService,
    private cache: MemoryCacheService,
  ) {}

  async updateStock(id: string, dto: UpdateStockDto) {
    const current = await this.prisma.watch.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Reloj no encontrado');

    const previousStock = current.stock;
    const watch = await this.prisma.watch.update({
      where: { id },
      data: { stock: dto.stock },
      include: { brand: true },
    });

    if (previousStock === 0 && dto.stock > 0) {
      this.logger.log(
        `[inventory:back-in-stock] watchId=${watch.id} slug=${watch.slug} stock=${dto.stock}`,
      );
      await this.waitlistService.notifyBackInStock(watch.id);
    }

    if (dto.stock === 0 && previousStock > 0) {
      this.logger.log(`[inventory:out-of-stock] watchId=${watch.id} slug=${watch.slug}`);
    }

    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return watch;
  }
}
