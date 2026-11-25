import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

function cloudinaryMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  if (/timeout|timed out/i.test(raw)) {
    return 'La carga tardó demasiado. Intenta de nuevo.';
  }
  if (/file size|too large|entity too large/i.test(raw)) {
    return 'El archivo pesa demasiado para guardarlo.';
  }
  if (/invalid image|unsupported|format|svg/i.test(raw)) {
    return 'El archivo no se pudo guardar. Revisa que no esté dañado.';
  }
  return 'Falló el proceso de carga. Intenta de nuevo.';
}

/** Subida y borrado en Cloudinary (fotos y assets de homepage). */
@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  constructor(private config: ConfigService) {
    if (this.config.get('USE_MOCKS') !== 'true') {
      cloudinary.config({
        cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME'),
        api_key: this.config.get('CLOUDINARY_API_KEY'),
        api_secret: this.config.get('CLOUDINARY_API_SECRET'),
        secure: true,
      });
    }
  }

  async uploadToCloudinary(
    buffer: Buffer,
    publicId: string,
    folder?: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    if (this.config.get('USE_MOCKS') === 'true') {
      const format = typeof extra.format === 'string' ? extra.format : 'webp';
      return `https://res.cloudinary.com/mock/image/upload/${publicId}.${format}`;
    }

    const targetFolder =
      folder ??
      this.config.get<string>('CLOUDINARY_FOLDER', 'LUXTIMEE/watches');
    try {
      const result = await new Promise<{ secure_url: string }>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: targetFolder,
              public_id: publicId,
              resource_type: 'image',
              format: 'webp',
              ...extra,
            },
            (error, uploadResult) => {
              if (error || !uploadResult)
                reject(error ?? new Error('Upload fallido'));
              else resolve(uploadResult);
            },
          );
          stream.end(buffer);
        },
      );

      return result.secure_url;
    } catch (error) {
      this.logger.warn('upload_failed kind=image reason=upstream');
      throw new BadGatewayException(cloudinaryMessage(error));
    }
  }

  async deleteCloudinaryAsset(url: string): Promise<void> {
    if (this.config.get('USE_MOCKS') === 'true') return;
    const publicId = this.extractCloudinaryPublicId(url);
    if (!publicId) return;
    await cloudinary.uploader
      .destroy(publicId, { resource_type: 'image' })
      .catch(() => undefined);
  }

  private extractCloudinaryPublicId(url: string): string | null {
    if (!url.includes('res.cloudinary.com')) return null;
    const match = url.match(
      /\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i,
    );
    return match?.[1] ?? null;
  }

  homepageFolder(): string {
    const base = this.config.get<string>(
      'CLOUDINARY_FOLDER',
      'luxtime/watches',
    );
    if (base.endsWith('/watches'))
      return base.replace(/\/watches$/, '/homepage');
    return `${base.replace(/\/$/, '')}/homepage`;
  }

  async uploadHomepageImage(
    file: Express.Multer.File,
    prefix = 'founder',
  ): Promise<string> {
    const { randomUUID } = await import('crypto');
    return this.uploadToCloudinary(
      file.buffer,
      `${prefix}-${randomUUID()}`,
      this.homepageFolder(),
      { quality: 95 },
    );
  }

  async uploadHomepageSvg(
    file: Express.Multer.File,
    prefix = 'nav-logo',
  ): Promise<string> {
    const { randomUUID } = await import('crypto');
    return this.uploadToCloudinary(
      file.buffer,
      `${prefix}-${randomUUID()}`,
      this.homepageFolder(),
      { format: 'svg' },
    );
  }

}
