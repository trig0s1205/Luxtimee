import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads', 'watches');
const PUBLIC_PREFIX = '/uploads/watches';

export async function saveWatchImage(buffer: Buffer): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const filename = `watch-${randomUUID()}.webp`;
  await writeFile(join(UPLOADS_DIR, filename), buffer);

  return `${PUBLIC_PREFIX}/${filename}`;
}
