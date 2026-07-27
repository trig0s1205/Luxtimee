import type { MultiPartData } from 'h3';
import { readMultipartFormData } from 'h3';
import { Role } from '@prisma/client';
import { prisma } from '~/server/utils/prisma';
import { saveWatchImage, saveWatchVideo } from '~/server/utils/storage';
import { calcMarginPercent } from '~/server/utils/margin';

const IMAGE_PROCESS_URL = 'http://localhost:8001/api/v1/process-watch';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

function getTextField(parts: MultiPartData[] | undefined, name: string): string | undefined {
  const part = parts?.find((item) => item.name === name && item.data);
  if (!part?.data) return undefined;
  const value = part.data.toString('utf-8').trim();
  return value.length > 0 ? value : undefined;
}

function getFilePart(parts: MultiPartData[] | undefined, name: string): MultiPartData | undefined {
  return parts?.find(
    (item) => item.name === name && item.filename && item.data && item.data.length > 0,
  );
}

async function processWatchImage(file: MultiPartData): Promise<Buffer> {
  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw createError({ statusCode: 400, statusMessage: 'Formato de imagen no válido. Usa JPG, PNG o WEBP.' });
  }

  const formData = new FormData();
  const blob = new Blob([file.data!], { type: mimeType });
  formData.append('file', blob, file.filename!);

  const response = await fetch(IMAGE_PROCESS_URL, { method: 'POST', body: formData });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[upload-watch] image-service error:', response.status, detail);
    throw createError({
      statusCode: 502,
      statusMessage: detail || 'El microservicio de imágenes no pudo procesar el archivo.',
    });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    console.error('[upload-watch] image-service devolvió buffer vacío');
    throw createError({ statusCode: 502, statusMessage: 'El microservicio devolvió una imagen vacía.' });
  }

  return buffer;
}

export default defineEventHandler(async (event) => {
  try {
    const parts = await readMultipartFormData(event);
    if (!parts?.length) {
      throw createError({ statusCode: 400, statusMessage: 'Se requiere multipart/form-data.' });
    }

    const name = getTextField(parts, 'name');
    const brand = getTextField(parts, 'brand');
    const priceRaw = getTextField(parts, 'price');
    const retailPriceRaw = getTextField(parts, 'retailPrice') ?? priceRaw;
    const wholesalePriceRaw = getTextField(parts, 'wholesalePrice');
    const costPriceRaw = getTextField(parts, 'costPrice');
    const roleRaw = getTextField(parts, 'role');
    const description = getTextField(parts, 'description');
    const stockRaw = getTextField(parts, 'stock');
    const image1 = getFilePart(parts, 'image1');
    const image2 = getFilePart(parts, 'image2');
    const video = getFilePart(parts, 'video');

    if (!name || !brand || !retailPriceRaw) {
      throw createError({ statusCode: 400, statusMessage: 'Los campos name, brand y retailPrice son obligatorios.' });
    }
    if (!image1 || !image2 || !video) {
      throw createError({ statusCode: 400, statusMessage: 'image1, image2 y video son obligatorios.' });
    }

    const videoType = video.type || 'application/octet-stream';
    if (!ALLOWED_VIDEO_TYPES.has(videoType)) {
      throw createError({ statusCode: 400, statusMessage: 'El video debe ser MP4 o WEBM.' });
    }

    const retailPrice = Number(retailPriceRaw);
    const wholesalePrice = wholesalePriceRaw ? Number(wholesalePriceRaw) : retailPrice;
    const stock = stockRaw ? Number.parseInt(stockRaw, 10) : 1;
    const isSuperAdmin = roleRaw === Role.SUPER_ADMIN;
    const costPrice = isSuperAdmin && costPriceRaw ? Number(costPriceRaw) : null;

    const [processed1, processed2] = await Promise.all([
      processWatchImage(image1),
      processWatchImage(image2),
    ]);

    const [primaryImageUrl, secondaryImageUrl, videoUrl] = await Promise.all([
      saveWatchImage(processed1),
      saveWatchImage(processed2),
      saveWatchVideo(video.data!, video.filename!),
    ]);

    const retailMarginPercentage = costPrice !== null ? calcMarginPercent(retailPrice, costPrice) : null;
    const wholesaleMarginPercentage = costPrice !== null ? calcMarginPercent(wholesalePrice, costPrice) : null;

    const product = await prisma.product.create({
      data: {
        name,
        brand,
        price: retailPrice,
        retailPrice,
        wholesalePrice,
        costPrice,
        retailMarginPercentage,
        wholesaleMarginPercentage,
        description: description ?? null,
        primaryImageUrl,
        secondaryImageUrl,
        videoUrl,
        stock,
      },
    });

    return { success: true, product };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('[upload-watch] error inesperado:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Error inesperado al crear el producto.',
    });
  }
});
