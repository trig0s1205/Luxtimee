import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';

export class CreateShippingZoneDto {
  name!: string;
  cost!: number;
  isNational?: boolean;
}

@Injectable()
export class ShippingService {
  constructor(
    private prisma: PrismaService,
    private cache: MemoryCacheService,
  ) {}

  findAllPublic() {
    return this.prisma.shippingZone.findMany({ orderBy: { cost: 'asc' } });
  }

  findAll() {
    return this.findAllPublic();
  }

  async create(dto: CreateShippingZoneDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('El nombre de la zona es obligatorio');
    if (!Number.isFinite(dto.cost) || dto.cost < 0) {
      throw new BadRequestException('El costo debe ser un número válido');
    }

    const existing = await this.prisma.shippingZone.findUnique({ where: { name } });
    if (existing) throw new BadRequestException('Ya existe una zona con ese nombre');

    const zone = await this.prisma.shippingZone.create({
      data: {
        name,
        cost: Math.round(dto.cost),
        isNational: dto.isNational ?? false,
      },
    });
    this.cache.invalidateTag(CACHE_TAGS.shipping);
    return zone;
  }

  async update(id: string, cost: number) {
    if (!Number.isFinite(cost) || cost < 0) {
      throw new BadRequestException('El costo debe ser un número válido');
    }
    const zone = await this.prisma.shippingZone.update({
      where: { id },
      data: { cost: Math.round(cost) },
    });
    this.cache.invalidateTag(CACHE_TAGS.shipping);
    return zone;
  }

  async remove(id: string) {
    const zone = await this.prisma.shippingZone.findUnique({ where: { id } });
    if (!zone) throw new BadRequestException('Zona no encontrada');

    const ordersCount = await this.prisma.order.count({ where: { shippingZoneId: id } });
    if (ordersCount > 0) {
      throw new BadRequestException('No se puede eliminar: hay pedidos asociados a esta zona');
    }

    await this.prisma.shippingZone.delete({ where: { id } });
    this.cache.invalidateTag(CACHE_TAGS.shipping);
    return { ok: true };
  }
}
