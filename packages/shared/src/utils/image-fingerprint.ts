import { decode as decodeJpeg, encode as encodeJpeg } from 'jpeg-js';
import { decodePngRgba, encodePngRgba } from './png-rgba.js';

export const DHASH_WIDTH = 9;
export const DHASH_HEIGHT = 8;
/** Ignora diferencias de luminancia menores que el ruido de un JPEG. */
const DHASH_MIN_DELTA = 8;

/**
 * dHash de 64 bits. Una distancia de Hamming ≤ 10 (~16% de los bits) sigue
 * siendo la misma foto tras JPEG o un reescalado (también el de WhatsApp).
 * Por encima se considera otra imagen. El aviso no impide subir.
 */
export const PERCEPTUAL_HASH_MAX_DISTANCE = 10;

export type ImageFingerprint = {
  contentHash: string;
  perceptualHash: string | null;
};

export type FingerprintComparison = {
  kind: 'exact' | 'perceptual';
  distance: number;
};

export type StoredImageDuplicate = {
  watchId: string;
  sku: string;
  model: string;
  imageUrl: string;
  slot: string;
  kind: 'exact' | 'perceptual';
  distance: number;
};

export type ImageDuplicateMatch = {
  id: string;
  duplicates: StoredImageDuplicate[];
};

export type BatchDuplicate = {
  id: string;
  otherId: string;
  kind: 'exact' | 'perceptual';
  distance: number;
};

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8
    && bytes[0] === 137
    && bytes[1] === 80
    && bytes[2] === 78
    && bytes[3] === 71;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.slice();
  const digest = await crypto.subtle.digest('SHA-256', copy);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i += 1) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function dHashFromRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): string {
  if (width < 2 || height < 1 || rgba.length < width * height * 4) {
    throw new Error('imagen demasiado pequeña');
  }
  const gray = new Float64Array(DHASH_WIDTH * DHASH_HEIGHT);
  for (let gy = 0; gy < DHASH_HEIGHT; gy += 1) {
    const y0 = Math.floor((gy * height) / DHASH_HEIGHT);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / DHASH_HEIGHT));
    for (let gx = 0; gx < DHASH_WIDTH; gx += 1) {
      const x0 = Math.floor((gx * width) / DHASH_WIDTH);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / DHASH_WIDTH));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1 && y < height; y += 1) {
        for (let x = x0; x < x1 && x < width; x += 1) {
          const index = (y * width + x) * 4;
          sum += 0.299 * rgba[index] + 0.587 * rgba[index + 1] + 0.114 * rgba[index + 2];
          count += 1;
        }
      }
      gray[gy * DHASH_WIDTH + gx] = count ? sum / count : 0;
    }
  }
  let bits = 0n;
  let bit = 0;
  for (let gy = 0; gy < DHASH_HEIGHT; gy += 1) {
    for (let gx = 0; gx < DHASH_WIDTH - 1; gx += 1) {
      const left = gray[gy * DHASH_WIDTH + gx];
      const right = gray[gy * DHASH_WIDTH + gx + 1];
      if (left > right + DHASH_MIN_DELTA) bits |= 1n << BigInt(bit);
      bit += 1;
    }
  }
  return bits.toString(16).padStart(16, '0');
}

export function hammingDistanceHex(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!/^[a-f0-9]+$/.test(left) || left.length !== right.length || !left.length) return 64;
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let distance = 0;
  while (value) {
    value &= value - 1n;
    distance += 1;
  }
  return distance;
}

export function compareFingerprints(
  a: ImageFingerprint,
  b: ImageFingerprint,
  maxDistance = PERCEPTUAL_HASH_MAX_DISTANCE,
): FingerprintComparison | null {
  const left = a.contentHash.trim().toLowerCase();
  const right = b.contentHash.trim().toLowerCase();
  if (left.length === 64 && left === right) return { kind: 'exact', distance: 0 };
  if (!a.perceptualHash || !b.perceptualHash) return null;
  const distance = hammingDistanceHex(a.perceptualHash, b.perceptualHash);
  if (distance <= maxDistance) return { kind: 'perceptual', distance };
  return null;
}

export function findBatchDuplicates(
  items: Array<{ id: string } & ImageFingerprint>,
): BatchDuplicate[] {
  const found: BatchDuplicate[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const match = compareFingerprints(items[i], items[j]);
      if (!match) continue;
      found.push({ id: items[i].id, otherId: items[j].id, ...match });
      found.push({ id: items[j].id, otherId: items[i].id, ...match });
    }
  }
  return found;
}

export function decodeImageRgba(bytes: Uint8Array): {
  rgba: Uint8Array;
  width: number;
  height: number;
} {
  if (isPng(bytes)) return decodePngRgba(bytes);
  if (isJpeg(bytes)) {
    const decoded = decodeJpeg(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      tolerantDecoding: true,
      maxResolutionInMP: 80,
      maxMemoryUsageInMB: 512,
    });
    return { rgba: decoded.data, width: decoded.width, height: decoded.height };
  }
  throw new Error('formato no soportado');
}

export function encodeJpegRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  quality: number,
): Uint8Array {
  return encodeJpeg({ data: rgba, width, height }, quality).data;
}

export function encodePngImage(
  rgba: Uint8Array,
  width: number,
  height: number,
  filter: 0 | 1 | 2 | 3 | 4 = 0,
): Uint8Array {
  return encodePngRgba(rgba, width, height, filter);
}

export async function fingerprintImageBytes(bytes: Uint8Array): Promise<ImageFingerprint> {
  const contentHash = await sha256Hex(bytes);
  try {
    const image = decodeImageRgba(bytes);
    return {
      contentHash,
      perceptualHash: dHashFromRgba(image.rgba, image.width, image.height),
    };
  } catch {
    return { contentHash, perceptualHash: null };
  }
}
