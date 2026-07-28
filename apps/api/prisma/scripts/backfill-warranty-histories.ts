import { PrismaClient, OrderStage, OrderStatus, WarrantyHistoryStatus } from '@prisma/client';

const prisma = new PrismaClient();

function upper(value: string | null | undefined) {
  if (!value) return value ?? null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

async function main() {
  const orders = await prisma.order.findMany({
    where: { stage: OrderStage.ORDER, status: OrderStatus.ENTREGADO },
    include: { items: { include: { watch: { select: { sku: true } } } } },
  });

  let created = 0;
  for (const order of orders) {
    const saleDate = order.deliveredAt ?? order.updatedAt;
    for (const item of order.items) {
      const exists = await prisma.warrantyHistory.findUnique({
        where: { orderItemId: item.id },
      });
      if (exists) continue;

      await prisma.warrantyHistory.create({
        data: {
          orderId: order.id,
          orderItemId: item.id,
          customerName: upper(order.customerName) ?? '',
          customerAddress: upper(order.customerAddress) ?? '',
          customerPhone: upper(order.customerPhone),
          productSku: item.watch.sku,
          productName: upper(item.productName) ?? '',
          saleDate,
          status: WarrantyHistoryStatus.VENTA_ENTREGADA,
        },
      });
      created += 1;
    }
  }

  console.log(`Backfill completado: ${created} historias creadas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
