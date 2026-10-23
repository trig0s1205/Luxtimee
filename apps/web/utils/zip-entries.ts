import { readNtfsExtraTimes } from '@luxtime/shared';

export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
  encrypted: boolean;
  modifiedAt?: number;
  createdAt?: number;
};

const ZIP_LOCAL = 0x04034b50;
const ZIP_CD = 0x02014b50;
const ZIP_EOCD = 0x06054b50;

export const ZIP_LOOSE_FILE_LIMIT = 200 * 1024 * 1024;
const ZIP_HARD_LIMIT = 1536 * 1024 * 1024;

export function shouldRecommendLooseFiles(size: number) {
  return size > ZIP_LOOSE_FILE_LIMIT;
}

export async function readZipEntries(file: File): Promise<ZipEntry[]> {
  if (file.size > ZIP_HARD_LIMIT) {
    throw new Error('Este ZIP es demasiado grande. Elige las fotos sueltas.');
  }
  if (file.size < 22) {
    throw new Error('El archivo ZIP está vacío o dañado.');
  }

  const tailSize = Math.min(file.size, 66_000);
  const tail = new Uint8Array(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (
      tail[index] === 0x50 &&
      tail[index + 1] === 0x4b &&
      tail[index + 2] === 0x05 &&
      tail[index + 3] === 0x06
    ) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('No se pudo leer el ZIP. Si pesa mucho, elige las fotos sueltas.');
  }

  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error('Este ZIP es demasiado grande. Elige las fotos sueltas.');
  }

  const cd = new Uint8Array(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const cdView = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const entries: ZipEntry[] = [];
  let cursor = 0;
  while (cursor + 46 <= cd.length) {
    const signature = cdView.getUint32(cursor, true);
    if (signature !== ZIP_CD) break;
    const flags = cdView.getUint16(cursor + 8, true);
    const method = cdView.getUint16(cursor + 10, true);
    const modifiedAt = dosDateTimeToMs(
      cdView.getUint16(cursor + 12, true),
      cdView.getUint16(cursor + 14, true),
    );
    const compressedSize = cdView.getUint32(cursor + 20, true);
    const uncompressedSize = cdView.getUint32(cursor + 24, true);
    const nameLength = cdView.getUint16(cursor + 28, true);
    const extraLength = cdView.getUint16(cursor + 30, true);
    const commentLength = cdView.getUint16(cursor + 32, true);
    const localOffset = cdView.getUint32(cursor + 42, true);
    const nameStart = cursor + 46;
    const name = new TextDecoder().decode(cd.subarray(nameStart, nameStart + nameLength));
    const extraStart = nameStart + nameLength;
    const ntfsTimes = readNtfsExtraTimes(cd.subarray(extraStart, extraStart + extraLength));
    if (
      uncompressedSize === 0xffffffff ||
      compressedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      throw new Error('Este ZIP es demasiado grande. Elige las fotos sueltas.');
    }
    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localOffset,
      encrypted: (flags & 1) === 1,
      modifiedAt: ntfsTimes.modifiedAt ?? modifiedAt,
      createdAt: ntfsTimes.createdAt,
    });
    cursor = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function readZipEntry(file: File, entry: ZipEntry): Promise<Uint8Array> {
  if (entry.encrypted) {
    throw new Error(`${basename(entry.name)}: el ZIP está cifrado. Elige las fotos sueltas.`);
  }
  if (entry.method !== 0 && entry.method !== 8) {
    throw new Error(`${basename(entry.name)}: compresión no soportada. Elige las fotos sueltas.`);
  }
  const header = new Uint8Array(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
  if (header.length < 30) {
    throw new Error(`${basename(entry.name)}: no se pudo leer del ZIP.`);
  }
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (headerView.getUint32(0, true) !== ZIP_LOCAL) {
    throw new Error(`${basename(entry.name)}: no se pudo leer del ZIP.`);
  }
  const nameLength = headerView.getUint16(26, true);
  const extraLength = headerView.getUint16(28, true);
  const dataStart = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = new Uint8Array(
    await file.slice(dataStart, dataStart + entry.compressedSize).arrayBuffer(),
  );
  if (entry.method === 0) return compressed;
  return inflateRaw(compressed);
}

function dosDateTimeToMs(time: number, date: number) {
  const day = date & 0x1f;
  const month = (date >> 5) & 0x0f;
  const year = ((date >> 9) & 0x7f) + 1980;
  if (!date || month < 1 || month > 12 || day < 1) return undefined;
  const seconds = (time & 0x1f) * 2;
  const minutes = (time >> 5) & 0x3f;
  const hours = (time >> 11) & 0x1f;
  return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
}

function basename(name: string) {
  return name.split(/[/\\]/).pop() || name;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no puede abrir el ZIP. Elige las fotos sueltas.');
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const source = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(source).arrayBuffer());
}

export function isJunkZipName(name: string) {
  const base = name.split(/[/\\]/).pop() || name;
  if (!base || name.endsWith('/')) return true;
  if (base.startsWith('.')) return true;
  if (name.includes('__MACOSX')) return true;
  return base.toLowerCase() === 'thumbs.db' || base.toLowerCase() === 'desktop.ini';
}
