import {
  MAX_VIDEO_DURATION_SEC,
  MAX_VIDEO_DURATION_TOLERANCE_SEC,
  MAX_VIDEO_INPUT_BYTES,
} from '@luxtime/shared';

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

export function isAllowedVideoFile(file: File): boolean {
  if (ALLOWED_VIDEO_TYPES.has(file.type)) return true;
  return /\.(mp4|mov|webm)$/i.test(file.name);
}

export function formatVideoSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('No se pudo leer la duración del video'));
        return;
      }
      resolve(duration);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('No se pudo leer el archivo de video'));
    };

    video.src = url;
  });
}

export async function validateWatchVideoFile(file: File): Promise<string | null> {
  if (!isAllowedVideoFile(file)) {
    return 'Formato no válido. Usa MP4, MOV o WEBM.';
  }

  if (file.size > MAX_VIDEO_INPUT_BYTES) {
    return `El video pesa ${formatVideoSize(file.size)}. Máximo de entrada: 120 MB (se comprimirá automáticamente).`;
  }

  try {
    const duration = await getVideoDurationSec(file);
    const maxAllowed = MAX_VIDEO_DURATION_SEC + MAX_VIDEO_DURATION_TOLERANCE_SEC;
    if (duration > maxAllowed) {
      return `El video dura ${Math.ceil(duration)} s. Máximo permitido: ${MAX_VIDEO_DURATION_SEC} s.`;
    }
  } catch {
    return 'No se pudo leer el video. Prueba exportarlo de nuevo desde el iPhone.';
  }

  return null;
}
