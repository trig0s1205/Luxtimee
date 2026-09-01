import { BadGatewayException, BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { WatchesRepository } from './watches.repository';
import { CreateWatchDto, UpdateWatchDto } from './dto';
import { WatchQueryDto } from './dto/watch-query.dto';
import { computeWatchFinancials } from './utils/margin.util';
import { slugify } from '../common/utils/slug.util';
import { SettingsService } from '../settings/settings.service';
import { ImageProcessingService } from '../integrations/image-processing.service';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { assertMediaFile } from '../common/utils/file-magic.util';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { storefrontHideWhenEmpty } from '../common/utils/storefront-stock.util';
import { normalizeFaqItems } from '../common/utils/faq.util';

const MAX_CATALOG_FEATURED = 6;
const CATALOG_LIMIT_MESSAGE =
  'Límite alcanzado: Solo se permite mostrar un máximo de 6 relojes en el catálogo principal.';

export type MediaSlot = 'image1' | 'image2' | 'video';
export type MediaSlotResult =
  | { status: 'done' }
  | { status: 'error'; message: string };

function slotErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const msg = (response as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo procesar el archivo';
}

@Injectable()
export class WatchesService {  private readonly logger = new Logger(WatchesService.name);

  constructor(
    private watchesRepository: WatchesRepository,
    private settingsService: SettingsService,
    private imageProcessing: ImageProcessingService,
    private cache: MemoryCacheService,
  ) {}

  async findAll(query: WatchQueryDto) {
    return this.watchesRepository.findMany(query);
  }

  async findOne(id: string) {
    return this.watchesRepository.findById(id);
  }

  async countFeatured(excludeId?: string) {
    const count = await this.watchesRepository.countShowInCatalog(excludeId);
    return { count, max: MAX_CATALOG_FEATURED };
  }

  private async assertCatalogFeaturedLimit(showInCatalog: boolean, excludeId?: string) {
    if (!showInCatalog) return;
    const count = await this.watchesRepository.countShowInCatalog(excludeId);
    if (count >= MAX_CATALOG_FEATURED) {
      throw new BadRequestException(CATALOG_LIMIT_MESSAGE);
    }
  }

  private async applyGlobalCommission(data: Prisma.WatchCreateInput | Prisma.WatchUpdateInput) {
    const { percent } = await this.settingsService.getCommissionConfig();
    data.secretaryCommissionPercentage = percent;
  }

  private normalizeCost(cost?: number | null) {
    if (cost == null || cost <= 0) return null;
    return cost;
  }

  private normalizeReference(reference?: string | null) {
    if (!reference) return undefined;
    const trimmed = reference.trim();
    return trimmed ? trimmed.toUpperCase() : undefined;
  }

  private applySuperAdminFinancials(
    data: Prisma.WatchCreateInput | Prisma.WatchUpdateInput,
    input: {
      cost?: number | null;
      retailPrice: number;
      wholesalePrice: number;
    },
  ) {
    const cost = this.normalizeCost(input.cost);
    const financials = computeWatchFinancials({
      cost,
      retailPrice: input.retailPrice,
      wholesalePrice: input.wholesalePrice,
    });

    Object.assign(data, {
      cost,
      retailMarginPercentage: financials.retailMarginPercentage,
      wholesaleMarginPercentage: financials.wholesaleMarginPercentage,
      profitPercent: financials.profitPercent,
    });
  }

  async create(dto: CreateWatchDto, role: Role) {    if (!(await this.watchesRepository.brandExists(dto.brandId))) {
      throw new BadRequestException('La marca seleccionada no existe');
    }

    if (dto.categoryId && !(await this.watchesRepository.categoryExists(dto.categoryId))) {
      throw new BadRequestException('La clase seleccionada no existe');
    }

    const brand = await this.watchesRepository.findBrandById(dto.brandId);
    if (!brand) throw new NotFoundException('Marca no encontrada');
    const reference = this.normalizeReference(dto.reference);
    const sku = (await this.watchesRepository.allocateSku(dto.retailPrice, dto.gender)).trim().toUpperCase();

    const slugBase = slugify(`${dto.model}-${Date.now()}`);
    const uniqueSlug = await this.ensureUniqueSlug(slugBase);

    const showInCatalog = dto.showInCatalog ?? false;
    await this.assertCatalogFeaturedLimit(showInCatalog);

    const data: Prisma.WatchCreateInput = {      sku,
      brand: { connect: { id: dto.brandId } },
      model: dto.model,
      reference,
      slug: uniqueSlug,
      gender: dto.gender,
      warrantyMonths: dto.warrantyMonths ?? 1,
      movementType: dto.movementType ?? 'Automático',
      movementCaliber: dto.movementCaliber,
      caseDiameter: dto.caseDiameter,
      caseMaterial: dto.caseMaterial,
      bezelMaterial: dto.bezelMaterial,
      dialColor: dto.dialColor,
      crystalType: dto.crystalType,
      strapMaterial: dto.strapMaterial,
      waterResistance: dto.waterResistance,
      functions: dto.functions ?? [],
      specs: dto.specs ?? {},
      retailPrice: dto.retailPrice,
      wholesalePrice: dto.wholesalePrice,
      stock: dto.stock,
      status: dto.stock > 0 ? 'DISPONIBLE' : 'AGOTADO',
      isActive: dto.isActive ?? true,
      isPublished: dto.isPublished ?? true,
      showInCatalog,
      isLimitedEdition: dto.isLimitedEdition ?? false,      limitedEditionNumber: dto.limitedEditionNumber,
      description: dto.description,
      faqs: normalizeFaqItems(dto.faqs),
      images: dto.images ?? [],
      mainImageIndex: dto.mainImageIndex ?? 0,
      frontImageUrl: dto.images?.[dto.mainImageIndex ?? 0] ?? null,
    };

    await this.applyGlobalCommission(data);

    if (role === Role.SUPER_ADMIN) {
      this.applySuperAdminFinancials(data, {
        cost: dto.cost ?? null,
        retailPrice: dto.retailPrice,
        wholesalePrice: dto.wholesalePrice,
      });
    }

    if (dto.warrantyTemplateId) {
      data.warrantyTemplate = { connect: { id: dto.warrantyTemplateId } };
    }
    if (dto.careTemplateId) {
      data.careTemplate = { connect: { id: dto.careTemplateId } };
    }
    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }
    if (dto.mechanismId) {
      data.mechanism = { connect: { id: dto.mechanismId } };
    }

    const watch = await this.watchesRepository.create(data);
    this.logger.log(`[watches:create] ${watch.id} sku=${watch.sku}`);
    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return watch;
  }

  async update(id: string, dto: UpdateWatchDto, role: Role) {
    const existing = await this.watchesRepository.findById(id);

    if (dto.brandId && !(await this.watchesRepository.brandExists(dto.brandId))) {
      throw new BadRequestException('La marca seleccionada no existe');
    }

    if (dto.categoryId && !(await this.watchesRepository.categoryExists(dto.categoryId))) {
      throw new BadRequestException('La clase seleccionada no existe');
    }

    if (dto.showInCatalog === true) {
      await this.assertCatalogFeaturedLimit(true, id);
    }

    const data: Prisma.WatchUpdateInput = {};
    if (dto.brandId) data.brand = { connect: { id: dto.brandId } };
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.mechanismId !== undefined) {
      data.mechanism = dto.mechanismId
        ? { connect: { id: dto.mechanismId } }
        : { disconnect: true };
    }
    if (dto.model) {
      data.model = dto.model;
      data.slug = await this.ensureUniqueSlug(slugify(`${dto.model}-${id.slice(-6)}`), id);
    }
    if (dto.reference !== undefined) data.reference = this.normalizeReference(dto.reference);
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.warrantyMonths !== undefined) data.warrantyMonths = dto.warrantyMonths;
    if (dto.movementType) data.movementType = dto.movementType;
    if (dto.movementCaliber !== undefined) data.movementCaliber = dto.movementCaliber;
    if (dto.caseDiameter !== undefined) data.caseDiameter = dto.caseDiameter;
    if (dto.caseMaterial !== undefined) data.caseMaterial = dto.caseMaterial;
    if (dto.bezelMaterial !== undefined) data.bezelMaterial = dto.bezelMaterial;
    if (dto.dialColor !== undefined) data.dialColor = dto.dialColor;
    if (dto.crystalType !== undefined) data.crystalType = dto.crystalType;
    if (dto.strapMaterial !== undefined) data.strapMaterial = dto.strapMaterial;
    if (dto.waterResistance !== undefined) data.waterResistance = dto.waterResistance;
    if (dto.functions) data.functions = dto.functions;
    if (dto.specs) data.specs = dto.specs;
    if (dto.retailPrice !== undefined) data.retailPrice = dto.retailPrice;
    if (dto.wholesalePrice !== undefined) data.wholesalePrice = dto.wholesalePrice;
    if (dto.stock !== undefined) {
      data.stock = dto.stock;
      if (dto.stock > 0) {
        data.status = 'DISPONIBLE';
      } else {
        Object.assign(data, storefrontHideWhenEmpty(0));
      }
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.showInCatalog !== undefined) data.showInCatalog = dto.showInCatalog;
    if (dto.isLimitedEdition !== undefined) data.isLimitedEdition = dto.isLimitedEdition;    if (dto.limitedEditionNumber !== undefined) data.limitedEditionNumber = dto.limitedEditionNumber;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.faqs !== undefined) data.faqs = normalizeFaqItems(dto.faqs);
    if (dto.images) {
      data.images = dto.images;
      data.frontImageUrl = dto.images[dto.mainImageIndex ?? existing.mainImageIndex] ?? null;
    }
    if (dto.mainImageIndex !== undefined) {
      data.mainImageIndex = dto.mainImageIndex;
      const images = dto.images ?? existing.images;
      data.frontImageUrl = images[dto.mainImageIndex] ?? null;
    }
    if (dto.warrantyTemplateId) data.warrantyTemplate = { connect: { id: dto.warrantyTemplateId } };
    if (dto.careTemplateId !== undefined) {
      data.careTemplate = dto.careTemplateId
        ? { connect: { id: dto.careTemplateId } }
        : { disconnect: true };
    }

    if (role === Role.SUPER_ADMIN) {
      const retailPrice = dto.retailPrice ?? existing.retailPrice;
      const wholesalePrice = dto.wholesalePrice ?? existing.wholesalePrice;
      const cost = dto.cost !== undefined ? dto.cost : existing.cost;

      this.applySuperAdminFinancials(data, {
        cost,
        retailPrice,
        wholesalePrice,
      });
    } else {
      if (dto.cost === 0) {
        Object.assign(data, {
          cost: null,
          retailMarginPercentage: null,
          wholesaleMarginPercentage: null,
          profitPercent: null,
        });
      } else {
        delete (data as Partial<UpdateWatchDto>).cost;
        delete (data as Partial<UpdateWatchDto>).profitPercent;
        delete (data as Partial<UpdateWatchDto>).retailMarginPercentage;
        delete (data as Partial<UpdateWatchDto>).wholesaleMarginPercentage;
      }
      delete (data as Partial<UpdateWatchDto>).secretaryCommissionPercentage;
    }

    const watch = await this.watchesRepository.update(id, data);
    this.logger.log(`[watches:update] ${watch.id} sku=${watch.sku}`);
    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return watch;
  }

  async findPendingCost(page = 1, limit = 10) {
    return this.watchesRepository.findPendingCost(page, limit);
  }

  getInventoryInsights() {
    return this.watchesRepository.getInventoryInsights();
  }

  async remove(id: string) {
    await this.watchesRepository.findById(id);
    const watch = await this.watchesRepository.softDelete(id);
    this.logger.log(`[watches:delete] ${watch.id} sku=${watch.sku}`);
    this.cache.invalidateTag(CACHE_TAGS.catalog);
    return watch;
  }

  async uploadMedia(
    id: string,
    files: { image1?: Express.Multer.File; image2?: Express.Multer.File; video?: Express.Multer.File },
    _baseUrl: string,
  ) {
    const existing = await this.watchesRepository.findById(id);
    if (!files.image1 && !files.image2 && !files.video) {
      throw new BadRequestException('Debes enviar al menos un archivo (foto o video)');
    }

    const isProd = process.env.NODE_ENV === 'production';
    const mediaResults: Partial<Record<MediaSlot, MediaSlotResult>> = {};
    const data: Prisma.WatchUpdateInput = {};
    let imageNeedsReview = existing.imageNeedsReview;
    const writtenPaths: string[] = [];

    const tasks: Array<Promise<void>> = [];

    if (files.image1) {
      tasks.push((async () => {
        try {
          const stored = await this.processAndStoreWatchImage(files.image1!, isProd, writtenPaths);
          data.primaryImageUrl = stored.url;
          data.frontImageUrl = stored.url;
          if (stored.needsReview) imageNeedsReview = true;
          mediaResults.image1 = { status: 'done' };
        } catch (error) {
          this.logger.error(`uploadMedia image1: ${slotErrorMessage(error)}`);
          mediaResults.image1 = { status: 'error', message: slotErrorMessage(error) };
        }
      })());
    }

    if (files.image2) {
      tasks.push((async () => {
        try {
          const stored = await this.processAndStoreWatchImage(files.image2!, isProd, writtenPaths);
          data.secondaryImageUrl = stored.url;
          data.backImageUrl = stored.url;
          if (stored.needsReview) imageNeedsReview = true;
          mediaResults.image2 = { status: 'done' };
        } catch (error) {
          this.logger.error(`uploadMedia image2: ${slotErrorMessage(error)}`);
          mediaResults.image2 = { status: 'error', message: slotErrorMessage(error) };
        }
      })());
    }

    if (files.video) {
      tasks.push((async () => {
        try {
          assertMediaFile(files.video!, 'video');
          const videoBuffer = await this.imageProcessing.processVideoWithMicroservice(files.video!);
          const videoUrl = await this.persistWatchVideo(videoBuffer, isProd, writtenPaths);
          data.videoUrl = videoUrl;
          mediaResults.video = { status: 'done' };
        } catch (error) {
          this.logger.error(`uploadMedia video: ${slotErrorMessage(error)}`);
          mediaResults.video = { status: 'error', message: slotErrorMessage(error) };
        }
      })());
    }

    await Promise.all(tasks);

    const submitted = Object.keys(mediaResults) as MediaSlot[];
    const failed = submitted.filter((slot) => mediaResults[slot]?.status === 'error');
    const succeeded = submitted.filter((slot) => mediaResults[slot]?.status === 'done');

    if (succeeded.length === 0) {
      if (!isProd && writtenPaths.length) {
        await Promise.all(writtenPaths.map((path) => unlink(path).catch(() => undefined)));
      }
      throw new BadGatewayException(
        failed.map((slot) => {
          const result = mediaResults[slot];
          const label = slot === 'video' ? 'Video' : slot === 'image1' ? 'Foto principal' : 'Foto secundaria';
          return result?.status === 'error' ? `${label}: ${result.message}` : label;
        }).join(' · ') || 'No se pudo procesar la multimedia',
      );
    }

    if (typeof data.primaryImageUrl === 'string' || typeof data.secondaryImageUrl === 'string') {
      const primary = (typeof data.primaryImageUrl === 'string' ? data.primaryImageUrl : existing.primaryImageUrl)
        ?? existing.frontImageUrl;
      const secondary = (typeof data.secondaryImageUrl === 'string' ? data.secondaryImageUrl : existing.secondaryImageUrl)
        ?? existing.backImageUrl;
      data.images = [primary, secondary].filter((url): url is string => Boolean(url));
      data.mainImageIndex = 0;
      data.imageNeedsReview = imageNeedsReview;
    }

    const updated = await this.watchesRepository.update(id, data);
    this.cache.invalidateTag(CACHE_TAGS.catalog);

    if (!isProd) {
      const keep = [
        typeof data.primaryImageUrl === 'string' ? data.primaryImageUrl : existing.primaryImageUrl,
        typeof data.secondaryImageUrl === 'string' ? data.secondaryImageUrl : existing.secondaryImageUrl,
        typeof data.videoUrl === 'string' ? data.videoUrl : existing.videoUrl,
      ].filter((url): url is string => Boolean(url));
      await this.bestEffortDeleteUrls([
        existing.primaryImageUrl,
        existing.secondaryImageUrl,
        existing.videoUrl,
        ...(existing.images ?? []),
      ], keep);
    }

    return { ...updated, mediaResults };
  }

  private async processAndStoreWatchImage(
    file: Express.Multer.File,
    isProd: boolean,
    writtenPaths: string[],
  ): Promise<{ url: string; needsReview: boolean }> {
    assertMediaFile(file, 'image');
    let buffer: Buffer;
    let needsReview = false;

    try {
      buffer = await this.imageProcessing.processWithMicroservice(file);
    } catch (error) {
      this.logger.warn(`rembg falló, se sube original: ${slotErrorMessage(error)}`);
      buffer = file.buffer;
      needsReview = true;
    }

    try {
      return { url: await this.persistWatchImage(buffer, file, needsReview, isProd, writtenPaths), needsReview };
    } catch (cloudError) {
      if (!needsReview) {
        this.logger.warn(`Cloudinary de imagen procesada falló, se sube original: ${slotErrorMessage(cloudError)}`);
        const url = await this.persistWatchImage(file.buffer, file, true, isProd, writtenPaths);
        return { url, needsReview: true };
      }
      throw cloudError;
    }
  }

  private async persistWatchImage(
    buffer: Buffer,
    file: Express.Multer.File,
    needsReview: boolean,
    isProd: boolean,
    writtenPaths: string[],
  ): Promise<string> {
    if (isProd) {
      return this.imageProcessing.uploadToCloudinary(
        buffer,
        `watch-${needsReview ? 'raw-' : ''}${randomUUID()}`,
      );
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'watches');
    await mkdir(uploadsDir, { recursive: true });
    const ext = needsReview ? (extname(file.originalname).toLowerCase() || '.jpg') : '.webp';
    const name = `watch-${randomUUID()}${ext}`;
    const path = join(uploadsDir, name);
    await writeFile(path, buffer);
    writtenPaths.push(path);
    return `/uploads/watches/${name}`;
  }

  private async persistWatchVideo(
    buffer: Buffer,
    isProd: boolean,
    writtenPaths: string[],
  ): Promise<string> {
    if (isProd) {
      return this.imageProcessing.uploadVideoToCloudinary(buffer, `watch-video-${randomUUID()}`);
    }

    const videosDir = join(process.cwd(), 'uploads', 'watches', 'videos');
    await mkdir(videosDir, { recursive: true });
    const name = `watch-${randomUUID()}.mp4`;
    const path = join(videosDir, name);
    await writeFile(path, buffer);
    writtenPaths.push(path);
    return `/uploads/watches/videos/${name}`;
  }

  private async bestEffortDeleteUrls(urls: Array<string | null | undefined>, keep: string[]) {
    const keepSet = new Set(keep);
    const cwd = process.cwd();
    for (const url of urls) {
      if (!url || keepSet.has(url) || !url.startsWith('/uploads/')) continue;
      const absolute = join(cwd, url.replace(/^\//, ''));
      await unlink(absolute).catch(() => undefined);
    }
  }

  async uploadImages(id: string, files: Express.Multer.File[], baseUrl: string) {
    const watch = await this.watchesRepository.findById(id);
    const uploadedUrls = files.map((file) => `${baseUrl}/uploads/watches/${file.filename}`);
    const mergedImages = [...watch.images, ...uploadedUrls];
    const mainImageIndex = watch.images.length === 0 ? 0 : watch.mainImageIndex;

    return this.watchesRepository.update(id, {
      images: mergedImages,
      mainImageIndex,
      frontImageUrl: mergedImages[mainImageIndex] ?? null,
    });
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string) {
    let candidate = slug;
    let suffix = 1;
    while (true) {
      const existing = await this.watchesRepository.findBySlug(candidate);
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${slug}-${suffix.toString(36).toUpperCase()}`;
      suffix++;
    }
  }

}
