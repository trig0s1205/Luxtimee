import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  quoteWholesaleCart,
  type WholesaleExtraDef,
  type WholesalePackageDef,
  type WholesaleQuoteInputLine,
} from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface WholesaleOfferCatalog {
  extras: WholesaleExtraDef[];
  packages: Array<WholesalePackageDef & { startsAt: string | null; endsAt: string | null }>;
}

@Injectable()
export class WholesaleOffersService {
  constructor(private prisma: PrismaService) {}

  async getAdminState() {
    const [extras, packages] = await Promise.all([
      this.prisma.wholesaleExtra.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.wholesalePackage.findMany({
        orderBy: { createdAt: 'desc' },
        include: { watches: { select: { watchId: true } } },
      }),
    ]);
    return {
      extras,
      packages: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        minQuantity: pkg.minQuantity,
        unitPrice: pkg.unitPrice,
        isActive: pkg.isActive,
        startsAt: pkg.startsAt?.toISOString() ?? null,
        endsAt: pkg.endsAt?.toISOString() ?? null,
        watchIds: pkg.watches.map((row) => row.watchId),
      })),
    };
  }

  async getPublicCatalog(): Promise<WholesaleOfferCatalog> {
    const now = new Date();
    const [extras, packages] = await Promise.all([
      this.prisma.wholesaleExtra.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.wholesalePackage.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        include: { watches: { select: { watchId: true } } },
        orderBy: { minQuantity: 'asc' },
      }),
    ]);
    return {
      extras: extras.map((extra) => ({
        id: extra.id,
        name: extra.name,
        price: extra.price,
      })),
      packages: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        minQuantity: pkg.minQuantity,
        unitPrice: pkg.unitPrice,
        watchIds: pkg.watches.map((row) => row.watchId),
        startsAt: pkg.startsAt?.toISOString() ?? null,
        endsAt: pkg.endsAt?.toISOString() ?? null,
      })),
    };
  }

  async quoteLines(lines: WholesaleQuoteInputLine[]) {
    const catalog = await this.getPublicCatalog();
    try {
      return quoteWholesaleCart(lines, catalog.extras, catalog.packages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cotizar el pedido';
      throw new BadRequestException(message);
    }
  }

  async createExtra(input: { name: string; price: number; sortOrder?: number }) {
    const name = input.name.trim();
    try {
      return await this.prisma.wholesaleExtra.create({
        data: {
          name,
          price: input.price,
          sortOrder: input.sortOrder ?? 0,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe una opción con ese nombre');
      }
      throw error;
    }
  }

  async updateExtra(
    id: string,
    input: { name?: string; price?: number; sortOrder?: number; isActive?: boolean },
  ) {
    await this.ensureExtra(id);
    try {
      return await this.prisma.wholesaleExtra.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.price !== undefined ? { price: input.price } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe una opción con ese nombre');
      }
      throw error;
    }
  }

  async deleteExtra(id: string) {
    await this.ensureExtra(id);
    await this.prisma.wholesaleExtra.delete({ where: { id } });
    return { ok: true };
  }

  async createPackage(input: {
    name: string;
    minQuantity: number;
    unitPrice: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    watchIds?: string[];
  }) {
    const range = this.parseRange(input.startsAt, input.endsAt);
    const watchIds = await this.cleanWatchIds(input.watchIds ?? []);
    return this.prisma.wholesalePackage.create({
      data: {
        name: input.name.trim(),
        minQuantity: input.minQuantity,
        unitPrice: input.unitPrice,
        isActive: input.isActive ?? true,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        watches: { create: watchIds.map((watchId) => ({ watchId })) },
      },
      include: { watches: { select: { watchId: true } } },
    });
  }

  async updatePackage(
    id: string,
    input: {
      name?: string;
      minQuantity?: number;
      unitPrice?: number;
      isActive?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      watchIds?: string[];
    },
  ) {
    const current = await this.prisma.wholesalePackage.findUnique({ where: { id } });
    if (!current) throw new BadRequestException('Paquete no encontrado');
    const startsAt = input.startsAt !== undefined ? input.startsAt : current.startsAt?.toISOString() ?? null;
    const endsAt = input.endsAt !== undefined ? input.endsAt : current.endsAt?.toISOString() ?? null;
    const range = this.parseRange(startsAt, endsAt);
    const watchIds = input.watchIds ? await this.cleanWatchIds(input.watchIds) : null;
    return this.prisma.wholesalePackage.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.minQuantity !== undefined ? { minQuantity: input.minQuantity } : {}),
        ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        ...(watchIds
          ? {
              watches: {
                deleteMany: {},
                create: watchIds.map((watchId) => ({ watchId })),
              },
            }
          : {}),
      },
      include: { watches: { select: { watchId: true } } },
    });
  }

  async deletePackage(id: string) {
    const current = await this.prisma.wholesalePackage.findUnique({ where: { id } });
    if (!current) throw new BadRequestException('Paquete no encontrado');
    await this.prisma.wholesalePackage.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureExtra(id: string) {
    const extra = await this.prisma.wholesaleExtra.findUnique({ where: { id } });
    if (!extra) throw new BadRequestException('Opción no encontrada');
    return extra;
  }

  private parseRange(startsAt?: string | null, endsAt?: string | null) {
    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;
    if (start && Number.isNaN(start.getTime())) {
      throw new BadRequestException('Fecha de inicio inválida');
    }
    if (end && Number.isNaN(end.getTime())) {
      throw new BadRequestException('Fecha de fin inválida');
    }
    if (start && end && end < start) {
      throw new BadRequestException('La fecha de fin es anterior al inicio');
    }
    return { startsAt: start, endsAt: end };
  }

  private async cleanWatchIds(watchIds: string[]) {
    const unique = [...new Set(watchIds.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) return [];
    const found = await this.prisma.watch.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('Hay relojes que no existen');
    }
    return unique;
  }
}
