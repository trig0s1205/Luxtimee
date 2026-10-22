import { BadRequestException } from '@nestjs/common';
import { MAX_VIDEO_INPUT_BYTES, MAX_WATCH_IMAGE_BYTES } from '@luxtime/shared';

const GENERIC_CONTENT_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/binary',
]);

function isGenericContentType(mime?: string) {
  return !mime || GENERIC_CONTENT_TYPES.has(mime.toLowerCase());
}

const IMAGE_JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const IMAGE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_BYTES = MAX_WATCH_IMAGE_BYTES;
const MAX_SVG_BYTES = 512 * 1024;
const MAX_VIDEO_BYTES = MAX_VIDEO_INPUT_BYTES;
const SVG_UNSAFE =
  /<\s*(script|foreignObject|iframe|embed|object|link|meta)\b|<!DOCTYPE|<!ENTITY|javascript:|data:\s*text\/html|\son[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["'](?!#)/i;

export type MediaKind = 'image' | 'video';

export function detectImageMime(
  buffer: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buffer?.length) return null;
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(IMAGE_JPEG))
    return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(IMAGE_PNG))
    return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function detectVideoMime(
  buffer: Buffer,
): 'video/mp4' | 'video/webm' | null {
  if (buffer.length < 12) return null;
  // ISO BMFF (mp4/mov): size + 'ftyp' at offset 4
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  // WebM / Matroska EBML header
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }
  return null;
}

function looksLikeSvg(buffer: Buffer): boolean {
  if (!buffer.length || buffer.includes(0)) return false;
  const head = buffer.subarray(0, Math.min(buffer.length, 800)).toString('utf8').trim();
  return /^<\?xml[\s>]/i.test(head) || /^<svg[\s>]/i.test(head);
}

export function assertLogoBuffer(
  buffer: Buffer,
  declaredMime?: string,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml' {
  if (!buffer?.length) {
    throw new BadRequestException('El archivo está vacío.');
  }
  if (!looksLikeSvg(buffer)) {
    return assertImageBuffer(buffer, declaredMime);
  }
  if (buffer.length > MAX_SVG_BYTES) {
    throw new BadRequestException('El SVG pesa demasiado. Máximo 512 KB.');
  }
  const text = buffer.toString('utf8');
  if (!/<svg[\s>]/i.test(text) || SVG_UNSAFE.test(text) || /https?:\/\//i.test(text)) {
    throw new BadRequestException(
      'El SVG está dañado o incluye contenido no permitido.',
    );
  }
  if (declaredMime && !isGenericContentType(declaredMime)) {
    const allowed = ['image/svg+xml', 'text/xml', 'application/xml', 'text/plain'];
    if (!allowed.includes(declaredMime.toLowerCase())) {
      throw new BadRequestException(
        'El tipo del archivo no coincide con su contenido.',
      );
    }
  }
  return 'image/svg+xml';
}

export function assertImageBuffer(buffer: Buffer, declaredMime?: string) {
  if (!buffer?.length) {
    throw new BadRequestException('El archivo está vacío.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new BadRequestException('El archivo pesa demasiado. Máximo 10 MB.');
  }
  const detected = detectImageMime(buffer);
  if (!detected) {
    throw new BadRequestException(
      'El archivo no es un JPG, PNG o WEBP válido. Puede estar dañado o ser otro tipo.',
    );
  }
  if (declaredMime && !isGenericContentType(declaredMime)) {
    const normalized =
      declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;
    if (
      normalized !== detected &&
      !(normalized === 'image/jpeg' && detected === 'image/jpeg')
    ) {
      if (normalized !== detected) {
        throw new BadRequestException(
          'El tipo del archivo no coincide con su contenido.',
        );
      }
    }
  }
  return detected;
}

export function assertVideoBuffer(buffer: Buffer, declaredMime?: string) {
  if (!buffer?.length) {
    throw new BadRequestException('Video vacío');
  }
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new BadRequestException(
      'El video supera el tamaño máximo de entrada (120MB)',
    );
  }
  const detected = detectVideoMime(buffer);
  if (!detected) {
    throw new BadRequestException(
      'El archivo no es un video MP4 o WEBM válido',
    );
  }
  if (
    declaredMime &&
    !isGenericContentType(declaredMime) &&
    declaredMime !== detected
  ) {
    const allowedDeclared = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-m4v',
    ];
    if (!allowedDeclared.includes(declaredMime)) {
      throw new BadRequestException('El tipo MIME del video no es permitido');
    }
    // MOV/QuickTime comparte contenedor ISO BMFF con MP4
    if (!(declaredMime === 'video/quicktime' && detected === 'video/mp4')) {
      throw new BadRequestException(
        'El tipo MIME del video no coincide con su contenido',
      );
    }
  }
  return detected;
}

export function assertMediaFile(file: Express.Multer.File, kind: MediaKind) {
  if (kind === 'image') return assertImageBuffer(file.buffer, file.mimetype);
  return assertVideoBuffer(file.buffer, file.mimetype);
}

export { MAX_IMAGE_BYTES, MAX_SVG_BYTES, MAX_VIDEO_BYTES };
