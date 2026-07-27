import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads', 'watches');
const VIDEOS_DIR = join(UPLOADS_DIR, 'videos');
const PUBLIC_PREFIX = '/uploads/watches';

export async function saveWatchImage(buffer: Buffer): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const filename = `watch-${randomUUID()}.webp`;
  await writeFile(join(UPLOADS_DIR, filename), buffer);

  return `${PUBLIC_PREFIX}/${filename}`;
}

export async function saveWatchVideo(buffer: Buffer, originalName: string): Promise<string> {
  await mkdir(VIDEOS_DIR, { recursive: true });

  const ext = extname(originalName).toLowerCase() || '.mp4';
  const filename = `watch-${randomUUID()}${ext}`;
  await writeFile(join(VIDEOS_DIR, filename), buffer);

  return `${PUBLIC_PREFIX}/videos/${filename}`;
}
