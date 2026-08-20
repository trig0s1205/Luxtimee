import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FREE_SHIPPING_ZONE_NAME,
  isAlwaysFreeShippingZone,
} from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';

export class CreateShippingZoneDto {
  name!: string;
  cost!: number;
  isNational?: boolean;
  isManualCost?: boolean;
}

type ShippingZoneRecord = {
  id: string;
  name: string;
  cost: number;
  isNational: boolean;
  isManualCost: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ShippingService {
  constructor(
    private prisma: PrismaService,
    private cache: MemoryCacheService,
  ) {}

  private mapZone(zone: ShippingZoneRecord) {
    const alwaysFree = isAlwaysFreeShippingZone(zone.name);
    return {
      ...zone,
      cost: alwaysFree ? 0 : zone.cost,
      alwaysFree,
      isManualCost: zone.isManualCost,
    };
  }

  private resolveCost(name: string, cost: number): number {
    if (isAlwaysFreeShippingZone(name)) return 0;
    return Math.round(cost);
  }

  findAllPublic() {
    return this.prisma.shippingZone
      .findMany({ orderBy: { cost: 'asc' } })
      .then((zones) => zones.map((zone) => this.mapZone(zone)));
  }

  findAll() {
    return this.findAllPublic();
  }

  async create(dto: CreateShippingZoneDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('El nombre de la zona es obligatorio');
    if (isAlwaysFreeShippingZone(name)) {
      throw new BadRequestException(
        `La zona ${FREE_SHIPPING_ZONE_NAME} ya existe con envío gratuito fijo.`,
      );
    }
    if (!Number.isFinite(dto.cost) || dto.cost < 0) {
      throw new BadRequestException('El costo debe ser un número válido');
    }

    const existing = await this.prisma.shippingZone.findUnique({ where: { name } });
    if (existing) throw new BadRequestException('Ya existe una zona con ese nombre');

    const zone = await this.prisma.shippingZone.create({
      data: {
        name,
        cost: this.resolveCost(name, dto.cost),
        isNational: dto.isNational ?? false,
        isManualCost: dto.isManualCost ?? false,
      },
    });
    this.cache.invalidateTag(CACHE_TAGS.shipping);
    return this.mapZone(zone);
  }

  async update(id: string, cost?: number, isManualCost?: boolean) {
    const existing = await this.prisma.shippingZone.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Zona no encontrada');

    if (isAlwaysFreeShippingZone(existing.name)) {
      if (cost !== undefined && cost !== 0) {
        throw new BadRequestException(
          `El envío a ${FREE_SHIPPING_ZONE_NAME} es siempre gratuito y no se puede modificar.`,
        );
      }
      return this.mapZone(existing);
    }

    const updateData: Record<string, unknown> = {};
    if (cost !== undefined) {
      if (!Number.isFinite(cost) || cost < 0) {
        throw new BadRequestException('El costo debe ser un número válido');
      }
      updateData.cost = Math.round(cost);
    }
    if (isManualCost !== undefined) {
      updateData.isManualCost = isManualCost;
    }

    const zone = await this.prisma.shippingZone.update({
      where: { id },
      data: updateData,
    });
    this.cache.invalidateTag(CACHE_TAGS.shipping);
    return this.mapZone(zone);
  }

  async remove(id: string) {
    const zone = await this.prisma.shippingZone.findUnique({ where: { id } });
    if (!zone) throw new BadRequestException('Zona no encontrada');

    if (isAlwaysFreeShippingZone(zone.name)) {
      throw new BadRequestException(
        `No se puede eliminar la zona de ${FREE_SHIPPING_ZONE_NAME}.`,
      );
    }

    const ordersCount = await this.prisma.order.count({ where: { shippingZoneId: id } });
    if (ordersCount > 0) {
      throw new BadRequestException('No se puede eliminar: hay pedidos asociados a esta zona');
    }

    await this.prisma.shippingZone.delete({ where: { id } });
    this.cache.invalidateTag(CACHE_TAGS.shipping);
    return { ok: true };
  }
}
