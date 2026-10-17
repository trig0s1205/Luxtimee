import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAX_VIDEO_INPUT_BYTES } from '@luxtime/shared';
import { v2 as cloudinary } from 'cloudinary';
import {
  detectImageMime,
  detectVideoMime,
} from '../common/utils/file-magic.util';

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    /aborted|timeout/i.test(error.message)
  );
}

function mapGatewayError(
  kind: 'imagen' | 'video',
  error: unknown,
  status?: number,
): string {
  if (isTimeoutError(error)) {
    return kind === 'imagen'
      ? 'La carga tardó demasiado. Intenta de nuevo.'
      : 'La carga del video tardó demasiado. Usa un clip más corto.';
  }
  if (status === 400 || status === 415 || status === 422) {
    return kind === 'imagen'
      ? 'El archivo no es válido o está dañado.'
      : 'El video no es válido o está dañado.';
  }
  return kind === 'imagen'
    ? 'Falló el proceso de carga. Intenta de nuevo.'
    : 'Falló el proceso del video. Intenta de nuevo.';
}

function cloudinaryMessage(kind: 'imagen' | 'video', error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  if (/timeout|timed out/i.test(raw)) {
    return kind === 'imagen'
      ? 'La carga tardó demasiado. Intenta de nuevo.'
      : 'La carga del video tardó demasiado. Intenta de nuevo.';
  }
  if (/file size|too large|entity too large/i.test(raw)) {
    return 'El archivo pesa demasiado para guardarlo.';
  }
  if (/invalid image|unsupported|format|svg/i.test(raw)) {
    return 'El archivo no se pudo guardar. Revisa que no esté dañado.';
  }
  return 'Falló el proceso de carga. Intenta de nuevo.';
}

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

  async processWithMicroservice(file: Express.Multer.File): Promise<Buffer> {
    const baseUrl = this.config
      .get<string>('IMAGE_SERVICE_URL', 'http://localhost:8001')
      .replace(/\/$/, '');
    const endpoints = [`${baseUrl}/api/v1/process-watch`, `${baseUrl}/process`];

    if (!file.buffer?.length) {
      throw new Error('El archivo de imagen no contiene buffer en memoria');
    }

    const mime = detectImageMime(file.buffer) ?? file.mimetype ?? 'image/jpeg';
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const formData = new FormData();
          const blob = new Blob([Uint8Array.from(file.buffer)], { type: mime });
          formData.append('file', blob, file.originalname);

          this.logger.log(
            `Procesando imagen en ${endpoint} (intento ${attempt}) mime=${mime} bytes=${file.buffer.length}`,
          );

          const headers: Record<string, string> = {};
          const apiKey = this.config
            .get<string>('IMAGE_SERVICE_API_KEY')
            ?.trim();
          if (apiKey) headers['X-API-Key'] = apiKey;

          const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers,
            signal: AbortSignal.timeout(240_000),
          });

          if (response.status === 404) {
            lastError = new Error(
              mapGatewayError(
                'imagen',
                new Error(`Image service respondió 404`),
                404,
              ),
            );
            break;
          }

          if (!response.ok) {
            const mapped = mapGatewayError(
              'imagen',
              new Error('upstream'),
              response.status,
            );
            lastError = new Error(mapped);
            this.logger.warn(`upload_failed kind=image reason=upstream status=${response.status}`);
            if (response.status < 500) break;
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (!buffer.length) {
            throw new Error('El microservicio devolvió una imagen vacía');
          }

          this.logger.log(
            `Imagen procesada correctamente (${buffer.length} bytes)`,
          );
          return buffer;
        } catch (error) {
          lastError = new Error(mapGatewayError('imagen', error));
          this.logger.warn('upload_failed kind=image reason=upstream');
          if (!isTimeoutError(error) && lastError.message.includes('API key'))
            break;
        }
      }
    }

    throw new BadGatewayException(
      lastError?.message ??
        'No se pudo procesar la imagen. Verifica que image-service esté corriendo en el puerto 8001.',
    );
  }

  async processVideoWithMicroservice(
    file: Express.Multer.File,
  ): Promise<Buffer> {
    if (this.config.get('USE_MOCKS') === 'true') {
      return file.buffer;
    }

    const baseUrl = this.config
      .get<string>('IMAGE_SERVICE_URL', 'http://localhost:8001')
      .replace(/\/$/, '');
    const endpoints = [
      `${baseUrl}/api/v1/process-video`,
      `${baseUrl}/process-video`,
    ];

    if (!file.buffer?.length) {
      throw new Error('El archivo de video no contiene buffer en memoria');
    }

    if (file.buffer.length > MAX_VIDEO_INPUT_BYTES) {
      throw new BadGatewayException(
        'El video supera el tamaño máximo de entrada (120MB)',
      );
    }

    const mime = detectVideoMime(file.buffer) ?? (file.mimetype || 'video/mp4');
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const formData = new FormData();
          const blob = new Blob([Uint8Array.from(file.buffer)], { type: mime });
          formData.append('file', blob, file.originalname || 'watch-video.mp4');

          this.logger.log(
            `Procesando video en ${endpoint} (intento ${attempt}) mime=${mime} bytes=${file.buffer.length}`,
          );

          const headers: Record<string, string> = {};
          const apiKey = this.config
            .get<string>('IMAGE_SERVICE_API_KEY')
            ?.trim();
          if (apiKey) headers['X-API-Key'] = apiKey;

          const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers,
            signal: AbortSignal.timeout(300_000),
          });

          if (response.status === 404) {
            lastError = new Error(
              mapGatewayError(
                'video',
                new Error('Image service respondió 404'),
                404,
              ),
            );
            break;
          }

          if (!response.ok) {
            const mapped = mapGatewayError(
              'video',
              new Error('upstream'),
              response.status,
            );
            lastError = new Error(mapped);
            this.logger.warn(`upload_failed kind=video reason=upstream status=${response.status}`);
            if (response.status < 500) break;
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (!buffer.length) {
            throw new Error('El microservicio devolvió un video vacío');
          }

          this.logger.log(
            `Video procesado correctamente (${buffer.length} bytes)`,
          );
          return buffer;
        } catch (error) {
          lastError = new Error(mapGatewayError('video', error));
          this.logger.warn('upload_failed kind=video reason=upstream');
          if (!isTimeoutError(error) && lastError.message.includes('API key'))
            break;
        }
      }
    }

    throw new BadGatewayException(
      lastError?.message ??
        'No se pudo procesar el video. Verifica que image-service esté corriendo.',
    );
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
      throw new BadGatewayException(cloudinaryMessage('imagen', error));
    }
  }

  async deleteCloudinaryAsset(
    url: string,
    resourceType: 'image' | 'video' = 'image',
  ): Promise<void> {
    if (this.config.get('USE_MOCKS') === 'true') return;
    const publicId = this.extractCloudinaryPublicId(url, resourceType);
    if (!publicId) return;
    await cloudinary.uploader
      .destroy(publicId, { resource_type: resourceType })
      .catch(() => undefined);
  }

  private extractCloudinaryPublicId(
    url: string,
    resourceType: 'image' | 'video',
  ): string | null {
    if (!url.includes('res.cloudinary.com')) return null;
    const type = resourceType === 'video' ? 'video' : 'image';
    const match = url.match(
      new RegExp(`\\/${type}\\/upload\\/(?:v\\d+\\/)?(.+)\\.[a-z0-9]+$`, 'i'),
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

  async uploadVideoToCloudinary(
    buffer: Buffer,
    publicId: string,
  ): Promise<string> {
    if (this.config.get('USE_MOCKS') === 'true') {
      return `https://res.cloudinary.com/mock/video/upload/${publicId}.mp4`;
    }

    const folder = this.config.get<string>(
      'CLOUDINARY_FOLDER',
      'LUXTIMEE/watches',
    );
    try {
      const result = await new Promise<{ secure_url: string }>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder,
              public_id: publicId,
              resource_type: 'video',
              format: 'mp4',
            },
            (error, uploadResult) => {
              if (error || !uploadResult)
                reject(error ?? new Error('Upload de video fallido'));
              else resolve(uploadResult);
            },
          );
          stream.end(buffer);
        },
      );

      return result.secure_url;
    } catch (error) {
      this.logger.warn('upload_failed kind=video reason=upstream');
      throw new BadGatewayException(cloudinaryMessage('video', error));
    }
  }
}
