import { spawn } from 'node:child_process';
import os from 'node:os';
import { getLanIp } from './get-lan-ip.mjs';

const ip = getLanIp();
const webPort = process.env.WEB_PORT ?? '3000';
const apiPort = process.env.PORT ?? '3001';
const webUrl = `http://${ip}:${webPort}`;

const sharedEnv = {
  ...process.env,
  NUXT_LAN: 'true',
  NUXT_PUBLIC_API_BASE_URL: `http://${ip}:${apiPort}/api/v1`,
  NUXT_PUBLIC_API_ASSETS_URL: `http://${ip}:${apiPort}`,
  NUXT_PUBLIC_SITE_URL: webUrl,
  NUXT_API_INTERNAL_URL: `http://127.0.0.1:${apiPort}/api/v1`,
  FRONTEND_URL: webUrl,
  HOST: '0.0.0.0',
};

console.log('\n=== Luxtime — modo red local ===');
console.log(`Tu IP: ${ip}`);
console.log(`Comparte con tu cliente: ${webUrl}`);
console.log('Ambos deben estar en la misma red Wi‑Fi.\n');

const isWindows = os.platform() === 'win32';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';

const api = spawn(pnpm, ['--filter', '@luxtime/api', 'start:dev'], {
  env: sharedEnv,
  stdio: 'inherit',
  shell: isWindows,
});

const web = spawn(pnpm, ['--filter', '@luxtime/web', 'dev'], {
  env: sharedEnv,
  stdio: 'inherit',
  shell: isWindows,
});

function shutdown(code = 0) {
  api.kill('SIGTERM');
  web.kill('SIGTERM');
  process.exit(code);
}

api.on('exit', (code) => shutdown(code ?? 0));
web.on('exit', (code) => shutdown(code ?? 0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
