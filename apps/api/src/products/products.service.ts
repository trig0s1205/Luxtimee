import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWatchDto, UpdateWatchDto } from './dto/watch.dto';
import { slugify } from '../common/utils/slug.util';

const watchInclude = {
  brand: true,
  warrantyTemplate: true,
  careTemplate: true,
} as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) {}

  private mapWatch<T extends Record<string, unknown>>(watch: T, role?: Role) {
    if (role === Role.SUPER_ADMIN) return watch;
    const { cost, profitPercent, ...rest } = watch;
    return rest;
  }

  async findAllStaff(role: Role) {
    const watches = await this.prisma.watch.findMany({
      include: watchInclude,
      orderBy: { createdAt: 'desc' },
    });
    return watches.map((w) => this.mapWatch(w, role));
  }

  async findOneStaff(id: string, role: Role) {
    const watch = await this.prisma.watch.findUnique({
      where: { id },
      include: watchInclude,
    });
    if (!watch) throw new NotFoundException('Reloj no encontrado');
    return this.mapWatch(watch, role);
  }

  async create(dto: CreateWatchDto, role: Role) {
    const slugBase = slugify(`${dto.model}-${Date.now()}`);
    const data = {
      ...dto,
      slug: slugBase,
      specs: dto.specs ?? {},
      cost: role === Role.SUPER_ADMIN ? dto.cost : undefined,
      profitPercent: role === Role.SUPER_ADMIN ? dto.profitPercent : undefined,
    };

    const watch = await this.prisma.watch.create({
      data,
      include: watchInclude,
    });

    this.logger.log(`[inventory:new-watch] ${watch.id} ${watch.slug}`);
    return this.mapWatch(watch, role);
  }

  async update(id: string, dto: UpdateWatchDto, role: Role) {
    await this.findOneStaff(id, role);

    const data: UpdateWatchDto & { slug?: string } = { ...dto };
    if (dto.model) {
      data.slug = slugify(`${dto.model}-${id.slice(-6)}`);
    }
    if (role !== Role.SUPER_ADMIN) {
      delete data.cost;
      delete data.profitPercent;
    }

    const watch = await this.prisma.watch.update({
      where: { id },
      data,
      include: watchInclude,
    });

    return this.mapWatch(watch, role);
  }

  async deactivate(id: string, role: Role) {
    return this.update(id, { isActive: false }, role);
  }

  async updateImages(
    id: string,
    images: { frontImageUrl?: string; backImageUrl?: string; imageNeedsReview?: boolean },
    role: Role,
  ) {
    const watch = await this.prisma.watch.update({
      where: { id },
      data: images,
      include: watchInclude,
    });
    return this.mapWatch(watch, role);
  }
}
