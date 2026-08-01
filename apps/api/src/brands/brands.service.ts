import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { slugify } from '../common/utils/slug.util';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';

@Injectable()
export class BrandsService {
  constructor(
    private prisma: PrismaService,
    private cache: MemoryCacheService,
  ) {}

  findAllPublic() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
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
    await this.ensureExists(id);
    const inUse = await this.prisma.watch.count({ where: { brandId: id } });
    if (inUse > 0) {
      throw new BadRequestException('No se puede eliminar: hay relojes asociados a esta marca.');
    }
    const brand = await this.prisma.brand.delete({ where: { id } });
    this.cache.invalidateTags([CACHE_TAGS.brands, CACHE_TAGS.catalog]);
    return brand;
  }

  private async ensureExists(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    return brand;
  }
}
