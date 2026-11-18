import {
  PERCEPTUAL_HASH_MAX_DISTANCE,
  compareFingerprints,
  dHashFromRgba,
  decodeImageRgba,
  encodeJpegRgba,
  encodePngImage,
  findBatchDuplicates,
  fingerprintImageBytes,
  hammingDistanceHex,
  sha256Hex,
} from '@luxtime/shared';
import { assertLocalDatabaseUrl } from './local-database';
import { imageSlotsFromWatch } from './image-slots';

function paint(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      const index = (y * width + x) * 4;
      rgba[index] = r;
      rgba[index + 1] = g;
      rgba[index + 2] = b;
      rgba[index + 3] = 255;
    }
  }
  return rgba;
}

function watchFace(width: number, height: number) {
  return paint(width, height, (x) => {
    const tone = Math.round((x / Math.max(1, width - 1)) * 220) + 15;
    return [tone, tone, tone];
  });
}

function otherPhoto(width: number, height: number) {
  return paint(width, height, (x, y) => {
    const column = Math.floor((x / width) * 4);
    const row = Math.floor((y / height) * 4);
    const on = (column + row) % 2 === 0;
    return on ? [12, 18, 28] : [240, 236, 228];
  });
}

function nearestResize(src: Uint8Array, sw: number, sh: number, dw: number, dh: number) {
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const sy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / dh));
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / dw));
      out.set(src.subarray((sy * sw + sx) * 4, (sy * sw + sx) * 4 + 4), (y * dw + x) * 4);
    }
  }
  return out;
}

describe('huella de imagen', () => {
  const width = 120;
  const height = 160;
  const original = watchFace(width, height);
  const different = otherPhoto(width, height);

  it('sha-256 idéntico y distinto', async () => {
    const png = encodePngImage(original, width, height);
    const hash = await sha256Hex(png);
    expect(hash).toHaveLength(64);
    expect(await sha256Hex(png)).toBe(hash);
    expect(await sha256Hex(encodePngImage(different, width, height))).not.toBe(hash);
  });

  it('png con filtros vuelve a los mismos pixeles', () => {
    for (const filter of [0, 1, 2, 4] as const) {
      const encoded = encodePngImage(original, width, height, filter);
      const decoded = decodeImageRgba(encoded);
      expect(decoded.width).toBe(width);
      expect(decoded.height).toBe(height);
      expect(Buffer.from(decoded.rgba)).toEqual(Buffer.from(original));
    }
  });

  it('detecta la misma foto recomprimida o reescalada y no una distinta', () => {
    const source = dHashFromRgba(original, width, height);
    const jpeg = encodeJpegRgba(original, width, height, 35);
    const recompressed = decodeImageRgba(jpeg);
    const resized = nearestResize(original, width, height, 64, 86);
    const resizedJpeg = decodeImageRgba(encodeJpegRgba(resized, 64, 86, 40));
    const other = different;

    const recompressedDistance = hammingDistanceHex(
      source,
      dHashFromRgba(recompressed.rgba, recompressed.width, recompressed.height),
    );
    const resizedDistance = hammingDistanceHex(
      source,
      dHashFromRgba(resizedJpeg.rgba, resizedJpeg.width, resizedJpeg.height),
    );
    const differentDistance = hammingDistanceHex(source, dHashFromRgba(other, width, height));

    expect(recompressedDistance).toBeLessThanOrEqual(PERCEPTUAL_HASH_MAX_DISTANCE);
    expect(resizedDistance).toBeLessThanOrEqual(PERCEPTUAL_HASH_MAX_DISTANCE);
    expect(differentDistance).toBeGreaterThan(PERCEPTUAL_HASH_MAX_DISTANCE);

    expect(compareFingerprints(
      { contentHash: 'a'.repeat(64), perceptualHash: source },
      { contentHash: 'b'.repeat(64), perceptualHash: dHashFromRgba(resizedJpeg.rgba, resizedJpeg.width, resizedJpeg.height) },
    )?.kind).toBe('perceptual');
    expect(compareFingerprints(
      { contentHash: 'a'.repeat(64), perceptualHash: source },
      { contentHash: 'b'.repeat(64), perceptualHash: dHashFromRgba(other, width, height) },
    )).toBeNull();
  });

  it('el hash exacto gana aunque el perceptual dispare', () => {
    expect(compareFingerprints(
      { contentHash: 'ab'.repeat(32), perceptualHash: '0'.repeat(16) },
      { contentHash: 'ab'.repeat(32), perceptualHash: 'f'.repeat(16) },
    )).toEqual({ kind: 'exact', distance: 0 });
  });

  it('marca duplicados dentro del mismo lote', () => {
    const hash = dHashFromRgba(original, width, height);
    const hits = findBatchDuplicates([
      { id: 'a', contentHash: 'aa'.repeat(32), perceptualHash: hash },
      { id: 'b', contentHash: 'bb'.repeat(32), perceptualHash: hash },
      { id: 'c', contentHash: 'cc'.repeat(32), perceptualHash: 'f'.repeat(16) },
    ]);
    expect(hits.map((hit) => hit.id).sort()).toEqual(['a', 'b']);
  });

  it('fingerprint de bytes conserva el sha y el dHash', async () => {
    const png = encodePngImage(original, width, height, 1);
    const fingerprint = await fingerprintImageBytes(png);
    expect(fingerprint.contentHash).toBe(await sha256Hex(png));
    expect(fingerprint.perceptualHash).toBe(dHashFromRgba(original, width, height));
  });

  it('solo acepta una base local', () => {
    expect(assertLocalDatabaseUrl('postgresql://luxtime:luxtime_dev@127.0.0.1:5432/luxtime').hostname).toBe('127.0.0.1');
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@db.example.com:5432/luxtime')).toThrow(/no es local/);
    expect(() => assertLocalDatabaseUrl('')).toThrow(/no está definida/);
  });

  it('arma frente, dorso y galería sin repetir la url', () => {
    expect(imageSlotsFromWatch({
      frontImageUrl: '/uploads/a.webp',
      backImageUrl: '/uploads/b.webp',
      images: ['/uploads/a.webp', '/uploads/b.webp', '/uploads/c.webp'],
    })).toEqual([
      { slot: 'front', imageUrl: '/uploads/a.webp' },
      { slot: 'back', imageUrl: '/uploads/b.webp' },
      { slot: 'gallery-2', imageUrl: '/uploads/c.webp' },
    ]);
  });
});
