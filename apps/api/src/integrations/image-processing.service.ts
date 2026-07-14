import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    const baseUrl = this.config.get<string>('IMAGE_SERVICE_URL', 'http://localhost:8001');

    if (this.config.get('USE_MOCKS') === 'true') {
      this.logger.warn('USE_MOCKS=true: devolviendo imagen original sin procesar');
      return file.buffer;
    }

    const formData = new FormData();
    const blob = new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype });
    formData.append('file', blob, file.originalname);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(`${baseUrl}/process`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Image service respondió ${response.status}`);
        }

        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Intento ${attempt} fallido en image-service: ${lastError.message}`);
      }
    }

    throw lastError ?? new Error('No se pudo procesar la imagen');
  }

  async uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
    if (this.config.get('USE_MOCKS') === 'true') {
      return `https://res.cloudinary.com/mock/image/upload/${publicId}.png`;
    }

    const folder = this.config.get<string>('CLOUDINARY_FOLDER', 'luxtime/watches');
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, public_id: publicId, resource_type: 'image', format: 'png' },
        (error, uploadResult) => {
          if (error || !uploadResult) reject(error ?? new Error('Upload fallido'));
          else resolve(uploadResult);
        },
      );
      stream.end(buffer);
    });

    return result.secure_url;
  }
}
