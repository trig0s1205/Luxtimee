import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { slugify } from '../common/utils/slug.util';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  findAllPublic() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  findAll() {
    return this.findAllPublic();
  }

  async create(dto: CreateCategoryDto) {
    const slug = slugify(dto.name);
    return this.prisma.category.create({
      data: { name: dto.name, slug },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, slug: slugify(dto.name) },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const inUse = await this.prisma.watch.count({ where: { categoryId: id } });
    if (inUse > 0) {
      throw new BadRequestException('No se puede eliminar: hay relojes asociados a esta clase.');
    }
    return this.prisma.category.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Clase no encontrada');
    return category;
  }
}
