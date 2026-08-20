import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAX_VIDEO_INPUT_BYTES } from '@luxtime/shared';
import { v2 as cloudinary } from 'cloudinary';
import { detectImageMime, detectVideoMime } from '../common/utils/file-magic.util';

function parseMicroserviceDetail(text: string): string | null {
  if (!text?.trim()) return null;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
    if (typeof parsed.detail === 'string' && parsed.detail.trim()) return parsed.detail.trim();
    if (Array.isArray(parsed.detail) && parsed.detail.length) {
      const first = parsed.detail[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && 'msg' in first) {
        const msg = (first as { msg?: unknown }).msg;
        if (typeof msg === 'string' && msg.trim()) return msg.trim();
      }
    }
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
  } catch {
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length <= 400 && !/^<!DOCTYPE/i.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'TimeoutError'
    || error.name === 'AbortError'
    || /aborted|timeout/i.test(error.message);
}

function mapGatewayError(
  kind: 'imagen' | 'video',
  error: unknown,
  status?: number,
  body?: string,
): string {
  if (isTimeoutError(error)) {
    return kind === 'imagen'
      ? 'Timeout: el servicio de imágenes no respondió a tiempo.'
      : 'Timeout: el servicio de video no respondió a tiempo. Usa un clip más corto.';
  }

  const detail = body ? parseMicroserviceDetail(body) : null;
  const raw = `${detail ?? ''} ${error instanceof Error ? error.message : ''}`;

  if (status === 401 || /api key inválida/i.test(raw)) {
    return 'API key del servicio de imágenes inválida.';
  }
  if (status === 503 || /api_key no configurada/i.test(raw)) {
    return 'El servicio de imágenes no tiene API key configurada.';
  }
  if (detail) return detail;
  if (status === 500 || /rembg|procesar la imagen/i.test(raw)) {
    return kind === 'imagen'
      ? 'Error de rembg al procesar la imagen.'
      : 'Error al procesar el video.';
  }
  if (error instanceof Error && error.message && !/https?:\/\//i.test(error.message)) {
    return error.message;
  }
  return kind === 'imagen'
    ? 'No se pudo procesar la imagen.'
    : 'No se pudo procesar el video.';
}

function cloudinaryMessage(kind: 'imagen' | 'video', error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Upload fallido';
  const short = raw.replace(/https?:\/\/\S+/gi, '').trim().slice(0, 180);
  return `Error de Cloudinary al subir ${kind === 'imagen' ? 'la imagen' : 'el video'}${short ? `: ${short}` : '.'}`;
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
    const baseUrl = this.config.get<string>('IMAGE_SERVICE_URL', 'http://localhost:8001').replace(/\/$/, '');
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

          this.logger.log(`Procesando imagen en ${endpoint} (intento ${attempt}) mime=${mime} bytes=${file.buffer.length}`);

          const headers: Record<string, string> = {};
          const apiKey = this.config.get<string>('IMAGE_SERVICE_API_KEY')?.trim();
          if (apiKey) headers['X-API-Key'] = apiKey;

          const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers,
            signal: AbortSignal.timeout(240_000),
          });

          if (response.status === 404) {
            lastError = new Error(mapGatewayError('imagen', new Error(`Image service respondió 404`), 404));
            break;
          }

          if (!response.ok) {
            const detail = await response.text().catch(() => '');
            const mapped = mapGatewayError('imagen', new Error(`HTTP ${response.status}`), response.status, detail);
            lastError = new Error(mapped);
            this.logger.error(`Fallo en ${endpoint} intento ${attempt}: ${mapped} status=${response.status}`);
            if (response.status < 500) break;
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (!buffer.length) {
            throw new Error('El microservicio devolvió una imagen vacía');
          }

          this.logger.log(`Imagen procesada correctamente (${buffer.length} bytes)`);
          return buffer;
        } catch (error) {
          lastError = new Error(mapGatewayError('imagen', error));
          this.logger.error(`Fallo en ${endpoint} intento ${attempt}: ${lastError.message}`);
          if (!isTimeoutError(error) && lastError.message.includes('API key')) break;
        }
      }
    }

    throw new BadGatewayException(
      lastError?.message ?? 'No se pudo procesar la imagen. Verifica que image-service esté corriendo en el puerto 8001.',
    );
  }

  async processVideoWithMicroservice(file: Express.Multer.File): Promise<Buffer> {
    if (this.config.get('USE_MOCKS') === 'true') {
      return file.buffer;
    }

    const baseUrl = this.config.get<string>('IMAGE_SERVICE_URL', 'http://localhost:8001').replace(/\/$/, '');
    const endpoints = [`${baseUrl}/api/v1/process-video`, `${baseUrl}/process-video`];

    if (!file.buffer?.length) {
      throw new Error('El archivo de video no contiene buffer en memoria');
    }

    if (file.buffer.length > MAX_VIDEO_INPUT_BYTES) {
      throw new BadGatewayException('El video supera el tamaño máximo de entrada (120MB)');
    }

    const mime = detectVideoMime(file.buffer) ?? file.mimetype || 'video/mp4';
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const formData = new FormData();
          const blob = new Blob([Uint8Array.from(file.buffer)], { type: mime });
          formData.append('file', blob, file.originalname || 'watch-video.mp4');

          this.logger.log(`Procesando video en ${endpoint} (intento ${attempt}) mime=${mime} bytes=${file.buffer.length}`);

          const headers: Record<string, string> = {};
          const apiKey = this.config.get<string>('IMAGE_SERVICE_API_KEY')?.trim();
          if (apiKey) headers['X-API-Key'] = apiKey;

          const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers,
            signal: AbortSignal.timeout(300_000),
          });

          if (response.status === 404) {
            lastError = new Error(mapGatewayError('video', new Error('Image service respondió 404'), 404));
            break;
          }

          if (!response.ok) {
            const detail = await response.text().catch(() => '');
            const mapped = mapGatewayError('video', new Error(`HTTP ${response.status}`), response.status, detail);
            lastError = new Error(mapped);
            this.logger.error(`Fallo video en ${endpoint} intento ${attempt}: ${mapped} status=${response.status}`);
            if (response.status < 500) break;
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (!buffer.length) {
            throw new Error('El microservicio devolvió un video vacío');
          }

          this.logger.log(`Video procesado correctamente (${buffer.length} bytes)`);
          return buffer;
        } catch (error) {
          lastError = new Error(mapGatewayError('video', error));
          this.logger.error(`Fallo video en ${endpoint} intento ${attempt}: ${lastError.message}`);
          if (!isTimeoutError(error) && lastError.message.includes('API key')) break;
        }
      }
    }

    throw new BadGatewayException(
      lastError?.message ?? 'No se pudo procesar el video. Verifica que image-service esté corriendo.',
    );
  }

  async uploadToCloudinary(buffer: Buffer, publicId: string, folder?: string): Promise<string> {
    if (this.config.get('USE_MOCKS') === 'true') {
      return `https://res.cloudinary.com/mock/image/upload/${publicId}.webp`;
    }

    const targetFolder = folder ?? this.config.get<string>('CLOUDINARY_FOLDER', 'LUXTIMEE/watches');
    try {
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: targetFolder, public_id: publicId, resource_type: 'image', format: 'webp' },
          (error, uploadResult) => {
            if (error || !uploadResult) reject(error ?? new Error('Upload fallido'));
            else resolve(uploadResult);
          },
        );
        stream.end(buffer);
      });

      return result.secure_url;
    } catch (error) {
      this.logger.error(`Cloudinary imagen: ${error instanceof Error ? error.message : 'Upload fallido'}`);
      throw new BadGatewayException(cloudinaryMessage('imagen', error));
    }
  }

  async deleteCloudinaryAsset(url: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
    if (this.config.get('USE_MOCKS') === 'true') return;
    const publicId = this.extractCloudinaryPublicId(url, resourceType);
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => undefined);
  }

  private extractCloudinaryPublicId(url: string, resourceType: 'image' | 'video'): string | null {
    if (!url.includes('res.cloudinary.com')) return null;
    const type = resourceType === 'video' ? 'video' : 'image';
    const match = url.match(new RegExp(`\\/${type}\\/upload\\/(?:v\\d+\\/)?(.+)\\.[a-z0-9]+$`, 'i'));
    return match?.[1] ?? null;
  }

  homepageFolder(): string {
    const base = this.config.get<string>('CLOUDINARY_FOLDER', 'luxtime/watches');
    if (base.endsWith('/watches')) return base.replace(/\/watches$/, '/homepage');
    return `${base.replace(/\/$/, '')}/homepage`;
  }

  async uploadHomepageImage(file: Express.Multer.File): Promise<string> {
    const { randomUUID } = await import('crypto');
    return this.uploadToCloudinary(file.buffer, `founder-${randomUUID()}`, this.homepageFolder());
  }

  async uploadVideoToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
    if (this.config.get('USE_MOCKS') === 'true') {
      return `https://res.cloudinary.com/mock/video/upload/${publicId}.mp4`;
    }

    const folder = this.config.get<string>('CLOUDINARY_FOLDER', 'LUXTIMEE/watches');
    try {
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: publicId,
            resource_type: 'video',
            format: 'mp4',
          },
          (error, uploadResult) => {
            if (error || !uploadResult) reject(error ?? new Error('Upload de video fallido'));
            else resolve(uploadResult);
          },
        );
        stream.end(buffer);
      });

      return result.secure_url;
    } catch (error) {
      this.logger.error(`Cloudinary video: ${error instanceof Error ? error.message : 'Upload fallido'}`);
      throw new BadGatewayException(cloudinaryMessage('video', error));
    }
  }
}
