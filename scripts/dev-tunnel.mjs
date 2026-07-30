import { execSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';

const webPort = process.env.WEB_PORT ?? '3000';
const apiPort = process.env.PORT ?? '3001';

function freePort(port) {
  if (os.platform() !== 'win32') return;
  try {
    execSync(
      `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`,
      { stdio: 'ignore', shell: 'cmd.exe' },
    );
  } catch {
    // Puerto libre o sin permisos.
  }
}

freePort(webPort);
freePort(apiPort);

const sharedEnv = {
  ...process.env,
  NUXT_LAN: 'true',
  NUXT_PUBLIC_API_BASE_URL: '/api/v1',
  NUXT_PUBLIC_API_ASSETS_URL: '',
  NUXT_API_INTERNAL_URL: `http://127.0.0.1:${apiPort}/api/v1`,
  HOST: '127.0.0.1',
};

const isWindows = os.platform() === 'win32';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
const npx = isWindows ? 'npx.cmd' : 'npx';
const children = [];
let publicUrl = '';

console.log('\n=== Luxtime — túnel público ===');
console.log('Iniciando web + API. La URL para tu cliente aparecerá en grande abajo.\n');

function spawnProc(label, command, args, options = {}) {
  const child = spawn(command, args, {
    env: sharedEnv,
    shell: isWindows,
    ...options,
  });
  child.on('exit', (code) => shutdown(code ?? 0));
  children.push({ label, child });
  return child;
}

function printPublicUrl(url) {
  if (!url || publicUrl === url) return;
  publicUrl = url;
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           COMPARTE ESTA URL CON TU CLIENTE                   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  ${url.padEnd(60)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

function startTunnel() {
  const tunnel = spawnProc(
    'tunnel',
    npx,
    ['-y', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${webPort}`],
    { stdio: ['inherit', 'pipe', 'pipe'] },
  );

  const onData = (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) printPublicUrl(match[0]);
  };

  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);
}

function waitForWeb(maxAttempts = 60) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts += 1;
      const req = http.get(`http://127.0.0.1:${webPort}`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) resolve(false);
        else setTimeout(check, 1000);
      });
      req.setTimeout(1500, () => {
        req.destroy();
        if (attempts >= maxAttempts) resolve(false);
        else setTimeout(check, 1000);
      });
    };
    check();
  });
}

spawnProc('api', pnpm, ['--filter', '@luxtime/api', 'start:dev'], { stdio: 'inherit' });
spawnProc('web', pnpm, ['--filter', '@luxtime/web', 'dev'], { stdio: 'inherit' });

waitForWeb().then((ready) => {
  if (!ready) console.warn('La web aún no responde en :3000, iniciando túnel igualmente...');
  startTunnel();
});

function shutdown(code = 0) {
  for (const { child } of children) child.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
