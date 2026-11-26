import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { slugify } from '../common/utils/slug.util';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';

const activeBrand = { deletedAt: null } satisfies Prisma.BrandWhereInput;

@Injectable()
export class BrandsService {
  constructor(
    private prisma: PrismaService,
    private cache: MemoryCacheService,
  ) {}

  findAllPublic() {
    return this.prisma.brand.findMany({
      where: activeBrand,
      orderBy: { name: 'asc' },
    });
  }

  findAll() {
    return this.findAllPublic();
  }

  async create(dto: CreateBrandDto) {
    const slug = slugify(dto.name);
    const brand = await this.prisma.brand.create({
      data: { name: dto.name, slug },
    });
    this.cache.invalidateTags([CACHE_TAGS.brands, CACHE_TAGS.catalog]);
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.ensureExists(id);
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { name: dto.name, slug: slugify(dto.name) },
    });
    this.cache.invalidateTags([CACHE_TAGS.brands, CACHE_TAGS.catalog]);
    return brand;
  }

  async remove(id: string) {
    const brand = await this.ensureExists(id);
    const active = await this.prisma.watch.count({
      where: { brandId: id, deletedAt: null },
    });
    if (active > 0) {
      const label = active === 1 ? 'reloj activo' : 'relojes activos';
      throw new BadRequestException(
        `No se puede eliminar: esta marca tiene ${active} ${label}.`,
      );
    }

    const archived = await this.prisma.watch.findMany({
      where: { brandId: id, NOT: { deletedAt: null } },
      select: { id: true },
    });
    const archivedIds = archived.map((watch) => watch.id);

    if (!archivedIds.length) {
      try {
        const deleted = await this.prisma.brand.delete({ where: { id } });
        this.cache.invalidateTags([CACHE_TAGS.brands, CACHE_TAGS.catalog]);
        return deleted;
      } catch (error) {
        throw this.deletionError(error);
      }
    }

    const withOrders = await this.prisma.orderItem.count({
      where: { watchId: { in: archivedIds } },
    });
    if (withOrders > 0) {
      return this.archiveBrand(brand);
    }

    try {
      const deleted = await this.prisma.$transaction(async (tx) => {
        await tx.review.updateMany({
          where: { watchId: { in: archivedIds } },
          data: { watchId: null },
        });
        await tx.watch.deleteMany({ where: { id: { in: archivedIds } } });
        return tx.brand.delete({ where: { id } });
      });
      this.cache.invalidateTags([CACHE_TAGS.brands, CACHE_TAGS.catalog]);
      return deleted;
    } catch (error) {
      if (this.isForeignKeyBlock(error)) {
        return this.archiveBrand(brand);
      }
      throw this.deletionError(error);
    }
  }

  private async archiveBrand(brand: { id: string; name: string; slug: string }) {
    const stamp = brand.id.slice(-6);
    const updated = await this.prisma.brand.update({
      where: { id: brand.id },
      data: {
        deletedAt: new Date(),
        name: `${brand.name} (eliminada ${stamp})`.slice(0, 180),
        slug: `${brand.slug}-eliminada-${stamp}`.slice(0, 180),
      },
    });
    this.cache.invalidateTags([CACHE_TAGS.brands, CACHE_TAGS.catalog]);
    return updated;
  }

  private isForeignKeyBlock(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    );
  }

  private deletionError(error: unknown): BadRequestException {
    if (error instanceof BadRequestException) return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Marca no encontrada');
      }
      if (error.code === 'P2003') {
        return new BadRequestException(
          'No se puede eliminar la marca porque todavía hay registros vinculados (P2003).',
        );
      }
      return new BadRequestException(
        `No se pudo eliminar la marca (${error.code}).`,
      );
    }
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim().slice(0, 180)
        : 'error desconocido';
    return new BadRequestException(`No se pudo eliminar la marca: ${detail}`);
  }

  private async ensureExists(id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, ...activeBrand },
    });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    return brand;
  }
}
