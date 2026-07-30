import os from 'node:os';

export function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (entry.address.startsWith('169.254.')) continue;
      candidates.push(entry.address);
    }
  }

  const preferred = candidates.find((ip) => ip.startsWith('192.168.') || ip.startsWith('10.'));
  return preferred ?? candidates[0] ?? '127.0.0.1';
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  console.log(getLanIp());
}
