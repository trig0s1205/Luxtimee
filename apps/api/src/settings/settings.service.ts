import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ImageProcessingService } from '../integrations/image-processing.service';
import type {
  CommissionConfigDto,
  CommissionUpdateResultDto,
  HomepageConfigDto,
  LegalDocumentsDto,
  PlatformConfigDto,
  ProfitConfigDto,
  WhatsappSettingDto,
} from '@luxtime/shared';
import { CACHE_TAGS } from '../common/cache/cache.decorator';
import { MemoryCacheService } from '../common/cache/memory-cache.service';

const HOMEPAGE_KEY = 'homepage_config';

const PUBLIC_SETTING_KEYS = new Set([
  'whatsapp_link',
  'legal_documents',
  'platform_config',
  HOMEPAGE_KEY,
]);

const DEFAULT_HOMEPAGE_CONFIG: HomepageConfigDto = {
  hero: {
    enabled: true,
    eyebrow: 'Luxury Timepieces · Colombia',
    title: 'Nuestros relojes hablan por sí solos.',
    subtitle: 'Elegance · Presence · Style',
    ctaText: 'Ver colección',
    ctaLink: '/catalogo',
    backgroundImageUrl: '',
  },
  featured: {
    enabled: true,
    label: 'Colección 2026',
    titleLead: 'Nuestros',
    titleEm: 'relojes',
    intro: 'Explora la selección completa: piezas con carácter, acabados premium y stock real listo para envío a todo Colombia.',
    ctaText: 'Ver catálogo completo',
    ctaLink: '/catalogo',
  },
  founder: {
    enabled: true,
    badge: 'Quién es LUXTIMEE',
    title: 'Más que un reloj.',
    titleEm: 'Una declaración.',
    quote: '"Elegir un reloj es elegir quién eres."',
    storyParagraphs: [
      'En LUXTIMEE creemos que el tiempo merece ser vivido con intensidad. Cada pieza que seleccionamos lleva consigo una historia, un propósito y una presencia que va más allá de la función.',
      'Desde Piedecuesta, Santander, curaduramos relojes para quienes no se conforman con lo ordinario. Personas que entienden que el estilo no se impone — se vive.',
    ],
    signatureName: 'LUXTIMEE',
    signatureRole: 'Fundador · Piedecuesta, Santander — Colombia',
    signatureImageUrl: '',
    carouselImages: ['', '', '', '', ''],
  },
  valueProps: {
    enabled: false,
    label: 'Por qué elegirnos',
    title: 'La diferencia LUXTIMEE',
    items: [],
  },
  customerProof: {
    enabled: true,
    label: 'Entregas reales',
    title: 'Clientes que ya',
    titleEm: 'recibieron su pieza',
    subtitle: 'Fotos de entregas locales y envíos nacionales. Sin renders ni stock de banco de imágenes.',
    images: [],
  },
  statement: {
    enabled: true,
    text: 'El detalle está en la entrega,',
    textEm: 'no en el discurso.',
    sub: 'LUXTIMEE · Piedecuesta · Colombia',
  },
  contact: {
    enabled: true,
    label: 'WhatsApp directo',
    title: '¿Buscas un modelo',
    titleEm: 'en específico?',
    body: 'Escríbenos el reloj, tu ciudad y si prefieres envío nacional o entrega local. Te respondemos con disponibilidad y tiempos reales.',
    ctaText: 'Abrir chat',
    whatsappMessage: 'Hola LUXTIMEE, busco un reloj en particular. Mi ciudad es ',
  },
};

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private cache: MemoryCacheService,
    private imageProcessing: ImageProcessingService,
  ) {}

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return (row?.value as T) ?? fallback;
  }

  async setJson(key: string, value: unknown) {
    const row = await this.prisma.setting.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
    if (PUBLIC_SETTING_KEYS.has(key)) {
      this.cache.invalidateTag(CACHE_TAGS.settings);
    }
    return row;
  }

  getWhatsappLink() {
    return this.getJson<WhatsappSettingDto>('whatsapp_link', {
      url: 'https://wa.me/573000000000',
      messagePrefix: 'Hola LUXTIMEE, deseo comprar:',
    });
  }

  setWhatsappLink(value: WhatsappSettingDto) {
    return this.setJson('whatsapp_link', value);
  }

  getLegalDocuments() {
    return this.getJson<LegalDocumentsDto>('legal_documents', {
      termsPublished: false,
      privacyPublished: false,
      termsDraft: '',
      privacyDraft: '',
    });
  }

  async getProfitConfig(): Promise<ProfitConfigDto> {
    const raw = await this.getJson<ProfitConfigDto & { defaultProfitPercent?: number }>('profit_config', {
      reinvestmentPercent: 35,
      ownerProfitPercent: 65,
    });
    return {
      reinvestmentPercent: raw.reinvestmentPercent ?? 35,
      ownerProfitPercent: raw.ownerProfitPercent ?? (100 - (raw.reinvestmentPercent ?? 35)),
    };
  }

  async setProfitConfig(value: ProfitConfigDto) {
    const reinvestment = Number(value.reinvestmentPercent);
    const owner = Number(value.ownerProfitPercent);

    if (!Number.isFinite(reinvestment) || reinvestment < 0 || reinvestment > 100) {
      throw new BadRequestException('El % de reinversión debe estar entre 0 y 100.');
    }
    if (!Number.isFinite(owner) || owner < 0 || owner > 100) {
      throw new BadRequestException('El % de ganancia libre debe estar entre 0 y 100.');
    }
    if (Math.round(reinvestment + owner) !== 100) {
      throw new BadRequestException('Reinversión y ganancia libre deben sumar 100%.');
    }

    return this.setJson('profit_config', {
      reinvestmentPercent: reinvestment,
      ownerProfitPercent: owner,
    });
  }

  getCommissionConfig() {
    return this.getJson<CommissionConfigDto>('commission_percent', { percent: 5 });
  }

  async setCommissionConfig(value: CommissionConfigDto): Promise<CommissionUpdateResultDto> {
    if (!Number.isFinite(value.percent) || value.percent < 0 || value.percent > 100) {
      throw new BadRequestException('El porcentaje de comisión debe estar entre 0 y 100.');
    }

    await this.setJson('commission_percent', value);

    const updated = await this.prisma.watch.updateMany({
      where: { deletedAt: null },
      data: { secretaryCommissionPercentage: value.percent },
    });

    return {
      percent: value.percent,
      updatedWatches: updated.count,
    };
  }

  getPlatformConfig() {
    return this.getJson<PlatformConfigDto>('platform_config', {
      supportEmail: 'help@luxtime.co',
      city: 'Piedecuesta, Santander — Colombia',
      instagramUrl: 'https://www.instagram.com/',
      tiktokUrl: 'https://www.tiktok.com/',
      facebookUrl: 'https://www.facebook.com/',
    });
  }

  setPlatformConfig(value: PlatformConfigDto) {
    return this.setJson('platform_config', value);
  }

  async getHomepageConfig(): Promise<HomepageConfigDto> {
    type LegacyFounder = Partial<HomepageConfigDto['founder']> & {
      mainImageUrl?: string;
      galleryImages?: string[];
    };

    const stored = await this.getJson<{
      hero?: HomepageConfigDto['hero'];
      featured?: HomepageConfigDto['featured'];
      founder?: LegacyFounder;
      valueProps?: HomepageConfigDto['valueProps'];
      customerProof?: HomepageConfigDto['customerProof'];
      statement?: HomepageConfigDto['statement'];
      contact?: HomepageConfigDto['contact'];
    }>(HOMEPAGE_KEY, {});

    const rawFounder: LegacyFounder = stored.founder ?? {};
    let carouselImages = Array.isArray(rawFounder.carouselImages)
      ? [...rawFounder.carouselImages]
      : [];

    if (carouselImages.filter(Boolean).length < 5) {
      const legacy: string[] = [];
      if (rawFounder.mainImageUrl) legacy.push(rawFounder.mainImageUrl);
      if (Array.isArray(rawFounder.galleryImages)) legacy.push(...rawFounder.galleryImages);
      const merged = [...carouselImages.filter(Boolean), ...legacy.filter(Boolean)];
      carouselImages = Array.from({ length: 5 }, (_, i) => merged[i] ?? '');
    } else {
      carouselImages = Array.from({ length: 5 }, (_, i) => carouselImages[i] ?? '');
    }

    return {
      hero: { ...DEFAULT_HOMEPAGE_CONFIG.hero, ...(stored.hero ?? {}) },
      featured: { ...DEFAULT_HOMEPAGE_CONFIG.featured, ...(stored.featured ?? {}) },
      founder: {
        ...DEFAULT_HOMEPAGE_CONFIG.founder,
        enabled: rawFounder.enabled ?? DEFAULT_HOMEPAGE_CONFIG.founder.enabled,
        badge: rawFounder.badge ?? DEFAULT_HOMEPAGE_CONFIG.founder.badge,
        title: rawFounder.title ?? DEFAULT_HOMEPAGE_CONFIG.founder.title,
        titleEm: rawFounder.titleEm ?? DEFAULT_HOMEPAGE_CONFIG.founder.titleEm,
        quote: rawFounder.quote ?? DEFAULT_HOMEPAGE_CONFIG.founder.quote,
        storyParagraphs: rawFounder.storyParagraphs ?? DEFAULT_HOMEPAGE_CONFIG.founder.storyParagraphs,
        signatureName: rawFounder.signatureName ?? DEFAULT_HOMEPAGE_CONFIG.founder.signatureName,
        signatureRole: rawFounder.signatureRole ?? DEFAULT_HOMEPAGE_CONFIG.founder.signatureRole,
        signatureImageUrl: rawFounder.signatureImageUrl ?? '',
        carouselImages,
      },
      valueProps: { ...DEFAULT_HOMEPAGE_CONFIG.valueProps, ...(stored.valueProps ?? {}) },
      customerProof: {
        ...DEFAULT_HOMEPAGE_CONFIG.customerProof,
        ...(stored.customerProof ?? {}),
        images: Array.isArray(stored.customerProof?.images)
          ? stored.customerProof!.images.map((img) => ({
              url: img?.url ?? '',
              caption: img?.caption ?? '',
            }))
          : DEFAULT_HOMEPAGE_CONFIG.customerProof.images,
      },
      statement: { ...DEFAULT_HOMEPAGE_CONFIG.statement, ...(stored.statement ?? {}) },
      contact: { ...DEFAULT_HOMEPAGE_CONFIG.contact, ...(stored.contact ?? {}) },
    };
  }

  async setHomepageConfig(patch: Partial<HomepageConfigDto>): Promise<HomepageConfigDto> {
    const current = await this.getHomepageConfig();
    const merged: HomepageConfigDto = {
      hero: patch.hero ? { ...current.hero, ...patch.hero } : current.hero,
      featured: patch.featured ? { ...current.featured, ...patch.featured } : current.featured,
      founder: patch.founder ? { ...current.founder, ...patch.founder } : current.founder,
      valueProps: patch.valueProps ? { ...current.valueProps, ...patch.valueProps } : current.valueProps,
      customerProof: patch.customerProof
        ? {
            ...current.customerProof,
            ...patch.customerProof,
            images: patch.customerProof.images ?? current.customerProof.images,
          }
        : current.customerProof,
      statement: patch.statement ? { ...current.statement, ...patch.statement } : current.statement,
      contact: patch.contact ? { ...current.contact, ...patch.contact } : current.contact,
    };

    if (merged.founder.enabled) {
      const imgs = (merged.founder.carouselImages ?? []).filter((u) => typeof u === 'string' && u.trim());
      if (imgs.length !== 5) {
        merged.founder.enabled = false;
        merged.founder.carouselImages = Array.from({ length: 5 }, (_, i) => merged.founder.carouselImages?.[i] ?? '');
      } else {
        merged.founder.carouselImages = imgs.slice(0, 5);
      }
    } else {
      merged.founder.carouselImages = Array.from({ length: 5 }, (_, i) => merged.founder.carouselImages?.[i] ?? '');
    }

    await this.setJson(HOMEPAGE_KEY, merged);
    return merged;
  }

  async uploadFounderImage(file: Express.Multer.File): Promise<{ url: string }> {
    const url = await this.imageProcessing.uploadHomepageImage(file);
    return { url };
  }

  async deleteFounderImage(url: string): Promise<void> {
    if (url.includes('res.cloudinary.com')) {
      await this.imageProcessing.deleteCloudinaryAsset(url, 'image');
      return;
    }

    const filename = url.replace(/^\/uploads\/homepage\//, '');
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new BadRequestException('URL de imagen inválida');
    }
    const dest = join(process.cwd(), 'uploads', 'homepage', filename);
    if (existsSync(dest)) {
      unlinkSync(dest);
    }
  }
}
