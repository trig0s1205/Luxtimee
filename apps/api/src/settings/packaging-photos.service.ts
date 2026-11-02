import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MAX_PACKAGING_CAPTION,
  MAX_PACKAGING_PHOTOS,
  type PackagingPhotoDto,
} from '@luxtime/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ImageProcessingService } from '../integrations/image-processing.service';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { sanitizePlainTextOptional } from '../common/utils/sanitize-text.util';

const ID_PATTERN = /^[a-z0-9_-]{1,64}$/i;

type PhotoRow = {
  id: string;
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
};

function toDto(row: PhotoRow): PackagingPhotoDto {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    caption: row.caption,
    sortOrder: row.sortOrder,
  };
}

@Injectable()
export class PackagingPhotosService {
  constructor(
    private prisma: PrismaService,
    private cache: MemoryCacheService,
    private imageProcessing: ImageProcessingService,
  ) {}

  async list(): Promise<PackagingPhotoDto[]> {
    const rows = await this.prisma.packagingPhoto.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDto);
  }

  async addImages(files: Express.Multer.File[]): Promise<PackagingPhotoDto[]> {
    if (!files.length) {
      throw new BadRequestException('No se recibieron imágenes');
    }

    const count = await this.prisma.packagingPhoto.count();
    if (count >= MAX_PACKAGING_PHOTOS) {
      throw new BadRequestException(
        `Ya hay ${MAX_PACKAGING_PHOTOS} fotos. Elimina alguna antes de subir más.`,
      );
    }
    if (count + files.length > MAX_PACKAGING_PHOTOS) {
      const room = MAX_PACKAGING_PHOTOS - count;
      throw new BadRequestException(
        `Puedes subir ${room} foto(s) más. El máximo es ${MAX_PACKAGING_PHOTOS}.`,
      );
    }

    const agg = await this.prisma.packagingPhoto.aggregate({
      _max: { sortOrder: true },
    });
    let sortOrder = (agg._max.sortOrder ?? -1) + 1;

    for (const file of files) {
      const imageUrl = await this.imageProcessing.uploadHomepageImage(
        file,
        'packaging',
      );
      await this.prisma.packagingPhoto.create({
        data: { imageUrl, sortOrder },
      });
      sortOrder += 1;
    }

    this.cache.invalidateTag(CACHE_TAGS.packaging);
    return this.list();
  }

  async updateCaption(
    id: string,
    caption: string,
  ): Promise<PackagingPhotoDto[]> {
    this.assertId(id);
    const existing = await this.prisma.packagingPhoto.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Foto de empaque no encontrada');

    const cleaned =
      sanitizePlainTextOptional(caption, MAX_PACKAGING_CAPTION) ?? null;
    await this.prisma.packagingPhoto.update({
      where: { id },
      data: { caption: cleaned },
    });
    this.cache.invalidateTag(CACHE_TAGS.packaging);
    return this.list();
  }

  async reorder(ids: string[]): Promise<PackagingPhotoDto[]> {
    if (!ids.length) {
      throw new BadRequestException('Indica el orden de las fotos.');
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('El orden tiene fotos repetidas.');
    }
    for (const id of ids) this.assertId(id);

    const existing = await this.prisma.packagingPhoto.findMany({
      select: { id: true },
    });
    const current = new Set(existing.map((row) => row.id));
    const sameSet =
      ids.length === current.size && ids.every((id) => current.has(id));
    if (!sameSet) {
      throw new BadRequestException(
        'El orden no coincide con las fotos guardadas. Recarga la página.',
      );
    }

    await this.prisma.$transaction(
      ids.map((id, sortOrder) =>
        this.prisma.packagingPhoto.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );
    this.cache.invalidateTag(CACHE_TAGS.packaging);
    return this.list();
  }

  async remove(id: string): Promise<PackagingPhotoDto[]> {
    this.assertId(id);
    const existing = await this.prisma.packagingPhoto.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Foto de empaque no encontrada');

    await this.prisma.packagingPhoto.delete({ where: { id } });
    this.cache.invalidateTag(CACHE_TAGS.packaging);
    await this.imageProcessing.deleteCloudinaryAsset(existing.imageUrl, 'image');
    return this.list();
  }

  private assertId(id: string) {
    if (!ID_PATTERN.test(id)) {
      throw new BadRequestException('Identificador inválido');
    }
  }
}
