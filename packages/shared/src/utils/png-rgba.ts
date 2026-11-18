import { deflate, inflate } from 'pako';

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const pa = Math.abs(estimate - left);
  const pb = Math.abs(estimate - up);
  const pc = Math.abs(estimate - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function filterScanline(
  filter: number,
  raw: Uint8Array,
  prev: Uint8Array | null,
  bpp: number,
): Uint8Array {
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    const left = i >= bpp ? raw[i - bpp] : 0;
    const up = prev ? prev[i] : 0;
    const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
    let predicted = 0;
    if (filter === 1) predicted = left;
    else if (filter === 2) predicted = up;
    else if (filter === 3) predicted = Math.floor((left + up) / 2);
    else if (filter === 4) predicted = paeth(left, up, upLeft);
    else if (filter !== 0) throw new Error('filtro png no soportado');
    out[i] = (raw[i] - predicted) & 255;
  }
  return out;
}

export function encodePngRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  filter: 0 | 1 | 2 | 3 | 4 = 0,
): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error('rgba incompleto');
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rawRows: Uint8Array[] = [new Uint8Array(height * (1 + width * 4))];
  let prev: Uint8Array | null = null;
  let offset = 0;
  const packed = rawRows[0];
  for (let y = 0; y < height; y += 1) {
    const raw = rgba.subarray(y * width * 4, (y + 1) * width * 4);
    const filtered = filterScanline(filter, raw, prev, 4);
    packed[offset] = filter;
    packed.set(filtered, offset + 1);
    offset += 1 + filtered.length;
    prev = raw;
  }
  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflate(packed)),
    chunk('IEND', new Uint8Array()),
  ]);
}

function readChunk(bytes: Uint8Array, offset: number) {
  if (offset + 8 > bytes.length) throw new Error('png truncado');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(offset);
  const type = String.fromCharCode(
    bytes[offset + 4],
    bytes[offset + 5],
    bytes[offset + 6],
    bytes[offset + 7],
  );
  const start = offset + 8;
  const end = start + length;
  if (end + 4 > bytes.length) throw new Error('png truncado');
  const data = bytes.subarray(start, end);
  const expected = view.getUint32(end);
  if (crc32(bytes.subarray(offset + 4, end)) !== expected) {
    throw new Error('crc png');
  }
  return { type, data, next: end + 4 };
}

function unfilter(data: Uint8Array, width: number, height: number, bpp: number) {
  const stride = width * bpp;
  const expected = height * (stride + 1);
  if (data.length < expected) throw new Error('png incompleto');
  const out = new Uint8Array(height * stride);
  let i = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = data[i];
    i += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = data[i];
      i += 1;
      const left = x >= bpp ? out[y * stride + x - bpp] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[(y - 1) * stride + x - bpp] : 0;
      let value = raw;
      if (filter === 1) value = (raw + left) & 255;
      else if (filter === 2) value = (raw + up) & 255;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (raw + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error('filtro png no soportado');
      out[y * stride + x] = value;
    }
  }
  return out;
}

export function decodePngRgba(bytes: Uint8Array): {
  rgba: Uint8Array;
  width: number;
  height: number;
} {
  if (bytes.length < 8 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error('no es png');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = new Uint8Array();
  let transparency = new Uint8Array();
  const idat: Uint8Array[] = [];
  let sawHeader = false;
  while (offset < bytes.length) {
    const part = readChunk(bytes, offset);
    offset = part.next;
    if (part.type === 'IHDR') {
      const view = new DataView(part.data.buffer, part.data.byteOffset, part.data.byteLength);
      width = view.getUint32(0);
      height = view.getUint32(4);
      bitDepth = part.data[8];
      colorType = part.data[9];
      if (part.data[12] !== 0) throw new Error('png entrelazado');
      sawHeader = true;
    } else if (part.type === 'PLTE') {
      palette = new Uint8Array(part.data);
    } else if (part.type === 'tRNS') {
      transparency = new Uint8Array(part.data);
    } else if (part.type === 'IDAT') {
      idat.push(new Uint8Array(part.data));
    } else if (part.type === 'IEND') {
      break;
    } else if ((part.type.charCodeAt(0) & 32) === 0) {
      throw new Error('chunk png no soportado');
    }
  }
  if (!sawHeader || !idat.length || !width || !height) throw new Error('png incompleto');
  if (bitDepth !== 8) throw new Error('profundidad png no soportada');
  const bpp = colorType === 0 || colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!bpp) throw new Error('color png no soportado');
  const inflated = inflate(concat(idat));
  const raw = unfilter(inflated, width, height, bpp);
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const target = i * 4;
    if (colorType === 6) {
      rgba.set(raw.subarray(i * 4, i * 4 + 4), target);
    } else if (colorType === 2) {
      rgba.set(raw.subarray(i * 3, i * 3 + 3), target);
      rgba[target + 3] = 255;
    } else if (colorType === 0) {
      rgba[target] = raw[i];
      rgba[target + 1] = raw[i];
      rgba[target + 2] = raw[i];
      rgba[target + 3] = 255;
    } else if (colorType === 4) {
      rgba[target] = raw[i * 2];
      rgba[target + 1] = raw[i * 2];
      rgba[target + 2] = raw[i * 2];
      rgba[target + 3] = raw[i * 2 + 1];
    } else {
      const index = raw[i];
      const paletteAt = index * 3;
      rgba[target] = palette[paletteAt] ?? 0;
      rgba[target + 1] = palette[paletteAt + 1] ?? 0;
      rgba[target + 2] = palette[paletteAt + 2] ?? 0;
      rgba[target + 3] = transparency.length ? (transparency[index] ?? 255) : 255;
    }
  }
  return { rgba, width, height };
}
