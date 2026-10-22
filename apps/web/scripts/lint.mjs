import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const eslintPkg = require.resolve('eslint/package.json');
const eslintBin = join(dirname(eslintPkg), 'bin', 'eslint.js');
const result = spawnSync(process.execPath, [eslintBin, '.', '--max-warnings', '0'], {
  stdio: 'inherit',
  env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'true' },
  cwd: new URL('..', import.meta.url),
});

process.exit(result.status ?? 1);
