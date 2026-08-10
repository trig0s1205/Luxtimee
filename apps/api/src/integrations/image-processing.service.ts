import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAX_VIDEO_INPUT_BYTES } from '@luxtime/shared';
import { v2 as cloudinary } from 'cloudinary';

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

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const formData = new FormData();
          const blob = new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype });
          formData.append('file', blob, file.originalname);

          this.logger.log(`Procesando imagen en ${endpoint} (intento ${attempt})`);

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
            lastError = new Error(`Image service respondió 404 en ${endpoint}`);
            break;
          }

          if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`Image service respondió ${response.status}: ${detail}`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (!buffer.length) {
            throw new Error('El microservicio devolvió una imagen vacía');
          }

          this.logger.log(`Imagen procesada correctamente (${buffer.length} bytes)`);
          return buffer;
        } catch (error) {
          lastError = error as Error;
          this.logger.error(`Fallo en ${endpoint} intento ${attempt}: ${lastError.message}`);
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

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const formData = new FormData();
          const blob = new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype || 'video/mp4' });
          formData.append('file', blob, file.originalname || 'watch-video.mp4');

          this.logger.log(`Procesando video en ${endpoint} (intento ${attempt})`);

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
            lastError = new Error(`Image service respondió 404 en ${endpoint}`);
            break;
          }

          if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`Image service respondió ${response.status}: ${detail}`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (!buffer.length) {
            throw new Error('El microservicio devolvió un video vacío');
          }

          this.logger.log(`Video procesado correctamente (${buffer.length} bytes)`);
          return buffer;
        } catch (error) {
          lastError = error as Error;
          this.logger.error(`Fallo video en ${endpoint} intento ${attempt}: ${lastError.message}`);
        }
      }
    }

    throw new BadGatewayException(
      lastError?.message ?? 'No se pudo procesar el video. Verifica que image-service esté corriendo.',
    );
  }

  async uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
    if (this.config.get('USE_MOCKS') === 'true') {
      return `https://res.cloudinary.com/mock/image/upload/${publicId}.webp`;
    }

    const folder = this.config.get<string>('CLOUDINARY_FOLDER', 'LUXTIMEE/watches');
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, public_id: publicId, resource_type: 'image', format: 'webp' },
        (error, uploadResult) => {
          if (error || !uploadResult) reject(error ?? new Error('Upload fallido'));
          else resolve(uploadResult);
        },
      );
      stream.end(buffer);
    });

    return result.secure_url;
  }

  async uploadVideoToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
    if (this.config.get('USE_MOCKS') === 'true') {
      return `https://res.cloudinary.com/mock/video/upload/${publicId}.mp4`;
    }

    const folder = this.config.get<string>('CLOUDINARY_FOLDER', 'LUXTIMEE/watches');
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
  }
}
