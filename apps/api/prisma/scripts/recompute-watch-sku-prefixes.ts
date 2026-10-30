/**
 * Recalcula el prefijo del SKU (RD/RM/RA/RP) conservando el consecutivo.
 * No reescribe OrderItem.productSku ni WarrantyHistory.productSku:
 * esos campos son la foto del código al momento del pedido o de la garantía.
 *
 * Ejecutar después de la migración que crea OrderItem.productSku:
 *   pnpm --filter @luxtime/api sku:recompute
 */
import { PrismaClient } from '@prisma/client';
import { planSkuRecompute } from '../../src/watches/utils/sku.util';

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'OrderItem' AND column_name = 'productSku'
  `;
  if (!columns.length) {
    throw new Error(
      'Falta OrderItem.productSku. Aplica la migración antes de recomputar SKUs.',
    );
  }

  const backfilled = await prisma.$executeRaw`
    UPDATE "OrderItem" AS oi
    SET "productSku" = w.sku
    FROM "Watch" AS w
    WHERE oi."watchId" = w.id
      AND btrim(oi."productSku") = ''
  `;

  const watches = await prisma.watch.findMany({
    select: { id: true, sku: true, retailPrice: true, gender: true },
  });
  const plan = planSkuRecompute(watches);
  if (!plan.length) {
    console.log(`Sin cambios de SKU. Líneas de pedido rellenadas: ${backfilled}.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const row of plan) {
      await tx.watch.update({
        where: { id: row.id },
        data: { sku: `TMP-${row.id}` },
      });
    }
    for (const row of plan) {
      await tx.watch.update({
        where: { id: row.id },
        data: { sku: row.to },
      });
    }
  });

  const kept = plan.filter((row) => row.keptSequence).length;
  console.log(
    `SKU actualizados: ${plan.length}. Consecutivo conservado: ${kept}. Reubicados por colisión: ${plan.length - kept}. Pedidos no modificados.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
