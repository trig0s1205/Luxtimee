/**
 * Backfill opcional de comprobantes para pedidos ya pagados (web/WhatsApp/mayoristas/especiales).
 *
 * Por defecto solo simula. Con --apply pide confirmación SI por stdin.
 *
 *   pnpm --filter @luxtime/api backfill:receipts
 *   pnpm --filter @luxtime/api backfill:receipts -- --apply
 */
import { createInterface } from 'readline';
import { NestFactory } from '@nestjs/core';
import { OrderStage, OrderStatus, OrderType, PrismaClient } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { ReceiptsService } from '../../src/receipts/receipts.service';

function dbHost(): string {
  const url = process.env.DATABASE_URL ?? '';
  try {
    const u = new URL(url);
    return u.hostname || '(desconocido)';
  } catch {
    return '(no parseable)';
  }
}

async function confirmApply(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question('Escribe SI para continuar: ', resolve);
  });
  rl.close();
  return answer.trim() === 'SI';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const host = dbHost();

  console.log('');
  console.log('============================================================');
  console.log('ATENCIÓN: haz un backup de la base antes de usar --apply.');
  console.log('La garantía se calcula con los meses ACTUALES de cada reloj.');
  console.log(`Host DATABASE_URL: ${host}`);
  console.log('============================================================');
  console.log('');

  if (/supabase/i.test(host) || (host !== 'localhost' && host !== '127.0.0.1')) {
    console.error('Abortado: solo se permite Postgres local (localhost/127.0.0.1).');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const eligible = await prisma.order.findMany({
    where: {
      stage: OrderStage.ORDER,
      canceledAt: null,
      receipt: null,
      OR: [
        { status: { in: [OrderStatus.PAGADO, OrderStatus.ENVIADO, OrderStatus.ENTREGADO] } },
        { type: OrderType.ESPECIAL },
      ],
    },
    select: {
      id: true,
      readableId: true,
      customerName: true,
      total: true,
      paidAt: true,
      deliveredAt: true,
      createdAt: true,
      source: true,
    },
    orderBy: [{ paidAt: 'asc' }, { deliveredAt: 'asc' }, { createdAt: 'asc' }],
  });

  console.log(`Pedidos elegibles: ${eligible.length}`);
  for (const order of eligible) {
    const date = (order.paidAt ?? order.deliveredAt ?? order.createdAt).toISOString();
    console.log(
      `${order.readableId}\t${date}\t${order.customerName || 'Cliente de mostrador'}\t${order.total}`,
    );
  }

  if (!apply) {
    console.log('\nSimulación terminada (sin escribir). Usa --apply para emitir.');
    await prisma.$disconnect();
    return;
  }

  if (!(await confirmApply())) {
    console.log('Cancelado.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const receipts = app.get(ReceiptsService);

  let ok = 0;
  for (const order of eligible) {
    const saleDate = order.paidAt ?? order.deliveredAt ?? order.createdAt;
    const channel = order.source === 'LOCAL' ? 'LOCAL' : 'WEB';
    await prisma.$transaction(async (tx) => {
      await receipts.issueInTx(tx, order.id, {
        channel,
        saleDate,
        backfilled: true,
      });
    });
    ok += 1;
    console.log(`OK ${order.readableId}`);
  }

  console.log(`Emitidos: ${ok}`);
  await app.close();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
