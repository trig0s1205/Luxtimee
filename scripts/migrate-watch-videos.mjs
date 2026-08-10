import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const script = join(dirname(fileURLToPath(import.meta.url)), '../apps/api/scripts/migrate-watch-videos.mjs');
const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', cwd: join(dirname(fileURLToPath(import.meta.url)), '../apps/api') });
process.exit(result.status ?? 1);
