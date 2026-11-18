import { decodeImageRgba, dHashFromRgba, sha256Hex, type ImageFingerprint } from '@luxtime/shared';

export async function fingerprintImageFile(file: Blob): Promise<ImageFingerprint> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = await sha256Hex(bytes);
  try {
    const image = decodeImageRgba(bytes);
    return {
      contentHash,
      perceptualHash: dHashFromRgba(image.rgba, image.width, image.height),
    };
  } catch {
    const perceptualHash = await dHashWithCanvas(file);
    return { contentHash, perceptualHash };
  }
}

async function dHashWithCanvas(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > 1600 ? 1600 / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('canvas');
    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    return dHashFromRgba(pixels.data, width, height);
  } finally {
    bitmap.close();
  }
}
