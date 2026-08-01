import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { slugify } from '../common/utils/slug.util';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private cache: MemoryCacheService,
  ) {}

  findAllPublic() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  findAll() {
    return this.findAllPublic();
  }

  async create(dto: CreateCategoryDto) {
    const slug = slugify(dto.name);
    const category = await this.prisma.category.create({
      data: { name: dto.name, slug },
    });
    this.cache.invalidateTags([CACHE_TAGS.categories, CACHE_TAGS.catalog]);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    const category = await this.prisma.category.update({
      where: { id },
      data: { name: dto.name, slug: slugify(dto.name) },
    });
    this.cache.invalidateTags([CACHE_TAGS.categories, CACHE_TAGS.catalog]);
    return category;
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const inUse = await this.prisma.watch.count({ where: { categoryId: id } });
    if (inUse > 0) {
      throw new BadRequestException('No se puede eliminar: hay relojes asociados a esta clase.');
    }
    const category = await this.prisma.category.delete({ where: { id } });
    this.cache.invalidateTags([CACHE_TAGS.categories, CACHE_TAGS.catalog]);
    return category;
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Clase no encontrada');
    return category;
  }
}
