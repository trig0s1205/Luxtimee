import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWatchDto, UpdateWatchDto } from './dto/watch.dto';
import { slugify } from '../common/utils/slug.util';
import { WatchesRepository } from '../watches/watches.repository';

const watchInclude = {
  brand: true,
  warrantyTemplate: true,
  careTemplate: true,
} as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private watchesRepository: WatchesRepository,
  ) {}

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
    const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
    if (!brand) throw new NotFoundException('Marca no encontrada');

    const sku = await this.watchesRepository.allocateSku(dto.retailPrice);
    const slugBase = slugify(`${dto.model}-${Date.now()}`);
    const uniqueSlug = await this.ensureUniqueSlug(slugBase);

    const data: Prisma.WatchCreateInput = {
      sku,
      brand: { connect: { id: dto.brandId } },
      model: dto.model,
      slug: uniqueSlug,
      movementType: dto.movementType,
      specs: dto.specs ?? {},
      retailPrice: dto.retailPrice,
      wholesalePrice: dto.wholesalePrice,
      stock: dto.stock,
      cost: role === Role.SUPER_ADMIN ? dto.cost : undefined,
      profitPercent: role === Role.SUPER_ADMIN ? dto.profitPercent : undefined,
    };

    if (dto.warrantyTemplateId) {
      data.warrantyTemplate = { connect: { id: dto.warrantyTemplateId } };
    }
    if (dto.careTemplateId) {
      data.careTemplate = { connect: { id: dto.careTemplateId } };
    }

    const watch = await this.prisma.watch.create({
      data,
      include: watchInclude,
    });

    this.logger.log(`[inventory:new-watch] ${watch.id} ${watch.slug}`);
    return this.mapWatch(watch, role);
  }

  async update(id: string, dto: UpdateWatchDto, role: Role) {
    await this.findOneStaff(id, role);

    const data: Prisma.WatchUpdateInput = {};
    if (dto.brandId) data.brand = { connect: { id: dto.brandId } };
    if (dto.model) {
      data.model = dto.model;
      data.slug = await this.ensureUniqueSlug(slugify(`${dto.model}-${id.slice(-6)}`), id);
    }
    if (dto.movementType) data.movementType = dto.movementType;
    if (dto.specs) data.specs = dto.specs;
    if (dto.retailPrice !== undefined) data.retailPrice = dto.retailPrice;
    if (dto.wholesalePrice !== undefined) data.wholesalePrice = dto.wholesalePrice;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.warrantyTemplateId) data.warrantyTemplate = { connect: { id: dto.warrantyTemplateId } };
    if (dto.careTemplateId) data.careTemplate = { connect: { id: dto.careTemplateId } };

    if (role === Role.SUPER_ADMIN) {
      if (dto.cost !== undefined) data.cost = dto.cost;
      if (dto.profitPercent !== undefined) data.profitPercent = dto.profitPercent;
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

  private async ensureUniqueSlug(slug: string, excludeId?: string) {
    let candidate = slug;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.watch.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${slug}-${suffix.toString(36).toUpperCase()}`;
      suffix++;
    }
  }
}
