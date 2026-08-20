import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMechanismDto, UpdateMechanismDto } from './dto/mechanism.dto';
import { slugify } from '../common/utils/slug.util';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';

@Injectable()
export class MechanismsService {
  constructor(
    private prisma: PrismaService,
    private cache: MemoryCacheService,
  ) {}

  findAllPublic() {
    return this.prisma.mechanism.findMany({ orderBy: { name: 'asc' } });
  }

  findAll() {
    return this.findAllPublic();
  }

  async create(dto: CreateMechanismDto) {
    const slug = slugify(dto.name);
    const mechanism = await this.prisma.mechanism.create({
      data: { name: dto.name, slug },
    });
    this.cache.invalidateTags([CACHE_TAGS.mechanisms, CACHE_TAGS.catalog]);
    return mechanism;
  }

  async update(id: string, dto: UpdateMechanismDto) {
    await this.ensureExists(id);
    const mechanism = await this.prisma.mechanism.update({
      where: { id },
      data: { name: dto.name, slug: slugify(dto.name) },
    });
    this.cache.invalidateTags([CACHE_TAGS.mechanisms, CACHE_TAGS.catalog]);
    return mechanism;
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const inUse = await this.prisma.watch.count({ where: { mechanismId: id } });
    if (inUse > 0) {
      throw new BadRequestException('No se puede eliminar: hay relojes asociados a este mecanismo.');
    }
    const mechanism = await this.prisma.mechanism.delete({ where: { id } });
    this.cache.invalidateTags([CACHE_TAGS.mechanisms, CACHE_TAGS.catalog]);
    return mechanism;
  }

  private async ensureExists(id: string) {
    const mechanism = await this.prisma.mechanism.findUnique({ where: { id } });
    if (!mechanism) throw new NotFoundException('Mecanismo no encontrado');
    return mechanism;
  }
}
