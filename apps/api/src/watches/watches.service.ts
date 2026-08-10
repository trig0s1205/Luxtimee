import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { WatchesRepository } from './watches.repository';
import { CreateWatchDto, UpdateWatchDto } from './dto';
import { WatchQueryDto } from './dto/watch-query.dto';
import { generateSku } from './utils/sku.util';
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

const MAX_CATALOG_FEATURED = 6;
const CATALOG_LIMIT_MESSAGE =
  'Límite alcanzado: Solo se permite mostrar un máximo de 6 relojes en el catálogo principal.';

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
    const baseSku = generateSku(brand.name.trim().toUpperCase(), reference);
    const sku = (await this.watchesRepository.ensureUniqueSku(baseSku)).trim().toUpperCase();

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
      data.status = dto.stock > 0 ? 'DISPONIBLE' : 'AGOTADO';
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.showInCatalog !== undefined) data.showInCatalog = dto.showInCatalog;
    if (dto.isLimitedEdition !== undefined) data.isLimitedEdition = dto.isLimitedEdition;    if (dto.limitedEditionNumber !== undefined) data.limitedEditionNumber = dto.limitedEditionNumber;
    if (dto.description !== undefined) data.description = dto.description;
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
    files: { image1: Express.Multer.File; image2: Express.Multer.File; video: Express.Multer.File },
    _baseUrl: string,
  ) {
    const existing = await this.watchesRepository.findById(id);

    assertMediaFile(files.image1, 'image');
    assertMediaFile(files.image2, 'image');
    assertMediaFile(files.video, 'video');

    const [primaryBuffer, secondaryBuffer, videoBuffer] = await Promise.all([
      this.imageProcessing.processWithMicroservice(files.image1),
      this.imageProcessing.processWithMicroservice(files.image2),
      this.imageProcessing.processVideoWithMicroservice(files.video),
    ]);

    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      const [primaryImageUrl, secondaryImageUrl, videoUrl] = await Promise.all([
        this.imageProcessing.uploadToCloudinary(primaryBuffer, `watch-${randomUUID()}`),
        this.imageProcessing.uploadToCloudinary(secondaryBuffer, `watch-${randomUUID()}`),
        this.imageProcessing.uploadVideoToCloudinary(videoBuffer, `watch-video-${randomUUID()}`),
      ]);

      const updated = await this.watchesRepository.update(id, {
        primaryImageUrl,
        secondaryImageUrl,
        videoUrl,
        images: [primaryImageUrl, secondaryImageUrl],
        mainImageIndex: 0,
        frontImageUrl: primaryImageUrl,
        backImageUrl: secondaryImageUrl,
      });

      this.cache.invalidateTag(CACHE_TAGS.catalog);
      return updated;
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'watches');
    const videosDir = join(uploadsDir, 'videos');
    await mkdir(videosDir, { recursive: true });

    const primaryName = `watch-${randomUUID()}.webp`;
    const secondaryName = `watch-${randomUUID()}.webp`;
    const videoName = `watch-${randomUUID()}.mp4`;

    const primaryPath = join(uploadsDir, primaryName);
    const secondaryPath = join(uploadsDir, secondaryName);
    const videoPath = join(videosDir, videoName);
    const writtenPaths = [primaryPath, secondaryPath, videoPath];

    try {
      await Promise.all([
        writeFile(primaryPath, primaryBuffer),
        writeFile(secondaryPath, secondaryBuffer),
        writeFile(videoPath, videoBuffer),
      ]);

      const primaryImageUrl = `/uploads/watches/${primaryName}`;
      const secondaryImageUrl = `/uploads/watches/${secondaryName}`;
      const videoUrl = `/uploads/watches/videos/${videoName}`;

      const updated = await this.watchesRepository.update(id, {
        primaryImageUrl,
        secondaryImageUrl,
        videoUrl,
        images: [primaryImageUrl, secondaryImageUrl],
        mainImageIndex: 0,
        frontImageUrl: primaryImageUrl,
        backImageUrl: secondaryImageUrl,
      });

      await this.bestEffortDeleteUrls([
        existing.primaryImageUrl,
        existing.secondaryImageUrl,
        existing.videoUrl,
        ...(existing.images ?? []),
      ], [primaryImageUrl, secondaryImageUrl, videoUrl]);

      return updated;
    } catch (error) {
      await Promise.all(
        writtenPaths.map((path) => unlink(path).catch(() => undefined)),
      );
      throw error;
    }
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
