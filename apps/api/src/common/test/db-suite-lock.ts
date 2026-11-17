import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const lockPath = path.join(os.tmpdir(), 'luxtime-api-localhost-db.lock');

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serializa los specs que comparten el Postgres local (contadores y filas).
 * El lock es entre procesos de Jest; un PID muerto no bloquea el siguiente run.
 */
export async function acquireDbSuiteLock(): Promise<() => void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, String(process.pid));
      return () => {
        try {
          fs.closeSync(fd);
        } catch {
          /* ya cerrado */
        }
        try {
          if (fs.readFileSync(lockPath, 'utf8') === String(process.pid)) {
            fs.unlinkSync(lockPath);
          }
        } catch {
          /* otro proceso ya lo soltó */
        }
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      try {
        const raw = fs.readFileSync(lockPath, 'utf8');
        const holder = Number(raw);
        if (!pidAlive(holder)) {
          const again = fs.readFileSync(lockPath, 'utf8');
          if (again === raw) fs.unlinkSync(lockPath);
        }
      } catch {
        /* carrera con quien suelta el lock */
      }
      await sleep(100);
    }
  }
  throw new Error('Timeout esperando el lock de la base de prueba');
}
