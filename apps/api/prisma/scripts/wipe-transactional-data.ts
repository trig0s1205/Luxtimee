/**
 * Mantenimiento manual: vacía pedidos/prepedidos y movimiento financiero.
 * NO toca catálogo (Watch/Brand/…), fotos, settings ni usuarios.
 * NO repone stock (DELETE SQL directo; no pasa por restoreWatchStock).
 *
 * Uso:
 *   pnpm --filter @luxtime/api wipe:transactional              # dry-run (conteos)
 *   pnpm --filter @luxtime/api wipe:transactional -- --confirm # ejecuta
 *   WIPE_INCLUDE_AUDIT=1 ... -- --confirm                      # también AuditLog
 */
import { createHash } from 'crypto';
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

/** Preferir conexión directa (no pooler) para DELETE masivo. */
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

const INCLUDE_AUDIT =
  process.env.WIPE_INCLUDE_AUDIT === '1'
  || process.argv.includes('--include-audit');

const CONFIRM =
  process.env.WIPE_CONFIRM === '1' || process.argv.includes('--confirm');

type Counts = Record<string, number>;

async function catalogFingerprint() {
  const watches = await prisma.watch.findMany({
    select: { id: true, sku: true, stock: true, status: true },
    orderBy: { id: 'asc' },
  });
  const brands = await prisma.brand.count();
  const mechanisms = await prisma.mechanism.count();
  const categories = await prisma.category.count();
  const packaging = await prisma.packagingPhoto.count();
  const settings = await prisma.setting.count();
  const users = await prisma.user.count();
  const hash = createHash('sha256')
    .update(JSON.stringify(watches))
    .digest('hex')
    .slice(0, 16);
  const stockSum = watches.reduce((sum, w) => sum + w.stock, 0);
  return {
    watches: watches.length,
    brands,
    mechanisms,
    categories,
    packagingPhotos: packaging,
    settings,
    users,
    stockSum,
    stockFingerprint: hash,
  };
}

async function movementCounts(): Promise<Counts> {
  const [
    certificate,
    warrantyHistory,
    orderPayment,
    orderItem,
    order,
    notification,
    expense,
    auditLog,
  ] = await Promise.all([
    prisma.certificate.count(),
    prisma.warrantyHistory.count(),
    prisma.orderPayment.count(),
    prisma.orderItem.count(),
    prisma.order.count(),
    prisma.notification.count(),
    prisma.expense.count(),
    prisma.auditLog.count(),
  ]);
  const counts: Counts = {
    Certificate: certificate,
    WarrantyHistory: warrantyHistory,
    OrderPayment: orderPayment,
    OrderItem: orderItem,
    Order: order,
    Notification: notification,
    Expense: expense,
  };
  if (INCLUDE_AUDIT) counts.AuditLog = auditLog;
  else counts['AuditLog (no se toca; usa --include-audit)'] = auditLog;
  return counts;
}

async function wipe(tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) {
  // Orden: hijos sin onDelete Cascade → pagos/historial → pedidos → resto.
  // Certificate NO tiene onDelete: Cascade hacia OrderItem.
  const certificate = await tx.certificate.deleteMany();
  const warrantyHistory = await tx.warrantyHistory.deleteMany();
  const orderPayment = await tx.orderPayment.deleteMany();
  // OrderItem y OrderPayment/WarrantyHistory también caen por Cascade al borrar Order,
  // pero se borran explícitos por claridad y por Certificate.
  const orderItem = await tx.orderItem.deleteMany();
  const order = await tx.order.deleteMany();
  const notification = await tx.notification.deleteMany();
  const expense = await tx.expense.deleteMany();
  const result: Counts = {
    Certificate: certificate.count,
    WarrantyHistory: warrantyHistory.count,
    OrderPayment: orderPayment.count,
    OrderItem: orderItem.count,
    Order: order.count,
    Notification: notification.count,
    Expense: expense.count,
  };
  if (INCLUDE_AUDIT) {
    const auditLog = await tx.auditLog.deleteMany();
    result.AuditLog = auditLog.count;
  }
  return result;
}

async function main() {
  console.log(
    CONFIRM
      ? 'MODO EJECUCIÓN — borrado irreversible de movimiento'
      : 'MODO DRY-RUN — solo conteos; pasa --confirm para borrar',
  );
  console.log(`AuditLog: ${INCLUDE_AUDIT ? 'SÍ se vaciará' : 'NO se toca'}`);
  console.log('');

  const beforeCatalog = await catalogFingerprint();
  const before = await movementCounts();

  console.log('Catálogo / config (NO se borra):');
  for (const [k, v] of Object.entries(beforeCatalog)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('');
  console.log('Movimiento a vaciar:');
  let total = 0;
  for (const [k, v] of Object.entries(before)) {
    console.log(`  ${k}: ${v}`);
    if (!k.includes('no se toca')) total += v;
  }
  console.log(`  TOTAL filas afectadas: ${total}`);

  if (!CONFIRM) {
    console.log('\nSin --confirm: no se borró nada.');
    return;
  }

  const deleted = await prisma.$transaction(async (tx) => wipe(tx), {
    maxWait: 30_000,
    timeout: 120_000,
  });

  const after = await movementCounts();
  const afterCatalog = await catalogFingerprint();

  console.log('\nBorrado:');
  for (const [k, v] of Object.entries(deleted)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('\nConteos movimiento después:');
  for (const [k, v] of Object.entries(after)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('\nCatálogo después (debe coincidir fingerprint/stock):');
  for (const [k, v] of Object.entries(afterCatalog)) {
    console.log(`  ${k}: ${v}`);
  }

  if (beforeCatalog.stockFingerprint !== afterCatalog.stockFingerprint) {
    throw new Error('ALERTA: el fingerprint de stock/SKU cambió — revisar');
  }
  if (beforeCatalog.stockSum !== afterCatalog.stockSum) {
    throw new Error('ALERTA: la suma de stock cambió — revisar');
  }
  console.log('\nOK: stock y catálogo intactos. Consecutivo LX reinicia vía Order.count()=0.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
