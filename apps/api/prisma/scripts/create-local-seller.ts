/**
 * Crea un usuario con rol VENDEDOR_LOCAL.
 *
 * Uso:
 *   pnpm --filter @luxtime/api user:create-local-seller -- --email a@b.co --name "Nombre"
 *   pnpm --filter @luxtime/api user:create-local-seller -- --email a@b.co --name "Nombre" --apply
 *
 * Requiere LOCAL_SELLER_PASSWORD (mín. 10 caracteres). Dry-run por defecto.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../../src/auth/password.util';

function loadEnvFile() {
  const envPath = resolve(__dirname, '../../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1]?.trim() || undefined;
}

const APPLY = process.argv.includes('--apply');
const emailRaw = argValue('--email');
const name = argValue('--name');
const password = process.env.LOCAL_SELLER_PASSWORD?.trim() ?? '';

async function main() {
  if (!emailRaw) {
    console.error('Falta --email');
    process.exit(1);
  }
  if (!name) {
    console.error('Falta --name');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('LOCAL_SELLER_PASSWORD es obligatoria (mín. 10 caracteres)');
    process.exit(1);
  }

  const email = emailRaw.toLowerCase();
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== Role.VENDEDOR_LOCAL) {
      console.error(
        `El email ya existe con rol ${existing.role}; no se puede convertir.`,
      );
      process.exit(1);
    }

    console.log(
      APPLY
        ? `Aplicando: ${existing ? 'actualizar' : 'crear'} vendedor local ${email} (${name})`
        : `Dry-run: ${existing ? 'actualizaría' : 'crearía'} vendedor local ${email} (${name}). Usa --apply para ejecutar.`,
    );

    if (!APPLY) return;

    const passwordHash = hashPassword(password);
    if (existing) {
      await prisma.user.update({
        where: { email },
        data: { name, role: Role.VENDEDOR_LOCAL, passwordHash },
      });
      console.log(`Actualizado: ${email}`);
    } else {
      await prisma.user.create({
        data: {
          email,
          name,
          role: Role.VENDEDOR_LOCAL,
          passwordHash,
        },
      });
      console.log(`Creado: ${email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
