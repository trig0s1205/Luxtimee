import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes('--confirm') && process.env.WIPE_CONFIRM !== '1') {
    console.error('Ejecuta con --confirm o WIPE_CONFIRM=1 para borrar datos de prueba.');
    process.exit(1);
  }

  const result = await prisma.$transaction(async (tx) => {
    const certificate = await tx.certificate.deleteMany();
    const warrantyHistory = await tx.warrantyHistory.deleteMany();
    const orderItem = await tx.orderItem.deleteMany();
    const order = await tx.order.deleteMany();
    const wishlistItem = await tx.wishlistItem.deleteMany();
    const waitlistEntry = await tx.waitlistEntry.deleteMany();
    const review = await tx.review.deleteMany();
    const watch = await tx.watch.deleteMany();
    const product = await tx.product.deleteMany();
    const notification = await tx.notification.deleteMany();
    const marketingContact = await tx.marketingContact.deleteMany();
    const auditLog = await tx.auditLog.deleteMany();

    return {
      certificate,
      warrantyHistory,
      orderItem,
      order,
      wishlistItem,
      waitlistEntry,
      review,
      watch,
      product,
      notification,
      marketingContact,
      auditLog,
    };
  });

  console.log('Limpieza completada:');
  for (const [table, { count }] of Object.entries(result)) {
    console.log(`  ${table}: ${count}`);
  }
  console.log('\nConservado: marcas, clases, mecanismos, plantillas, zonas de envío, usuarios, settings, socios mayoristas.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
