-- CreateEnum
CREATE TYPE "OrderPaymentType" AS ENUM ('ABONO', 'SALDO');

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderPaymentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");
CREATE INDEX "OrderPayment_paidAt_idx" ON "OrderPayment"("paidAt");
CREATE INDEX "OrderPayment_type_idx" ON "OrderPayment"("type");
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt");
CREATE INDEX "Expense_name_idx" ON "Expense"("name");

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El abono vigente es $10.000 por reloj (suma de cantidades), detal y mayorista.
UPDATE "Order" AS o
SET "depositExpected" = COALESCE((
    SELECT (SUM(i.quantity) * 10000)::int
    FROM "OrderItem" AS i
    WHERE i."orderId" = o.id
), 0)
WHERE o.type <> 'ESPECIAL';

-- Abono ya confirmado. En pedidos ya liquidados se fecha junto al pago
-- para no mover el ingreso de periodo. En pendientes, updatedAt es la
-- mejor aproximación a la confirmación.
INSERT INTO "OrderPayment" ("id", "orderId", "type", "amount", "paidAt", "createdAt")
SELECT
    'abono_' || o.id,
    o.id,
    'ABONO',
    LEAST(o."depositExpected", GREATEST(o.total, 0)),
    CASE
        WHEN o.status IN ('PAGADO', 'ENVIADO', 'ENTREGADO')
            THEN COALESCE(o."paidAt", o."deliveredAt", o."updatedAt", o."createdAt")
        ELSE COALESCE(o."updatedAt", o."createdAt")
    END,
    CURRENT_TIMESTAMP
FROM "Order" AS o
WHERE o."depositConfirmed" = true
  AND o."canceledAt" IS NULL
  AND o.type <> 'ESPECIAL'
  AND o.status IS DISTINCT FROM 'CANCELADO'
  AND LEAST(o."depositExpected", GREATEST(o.total, 0)) > 0;

-- Saldo (o el total, si no hubo abono) de pedidos ya pagados, enviados,
-- entregados y ventas especiales. La suma de pagos queda igual al total.
INSERT INTO "OrderPayment" ("id", "orderId", "type", "amount", "paidAt", "createdAt")
SELECT
    'saldo_' || o.id,
    o.id,
    'SALDO',
    GREATEST(o.total - COALESCE(paid.amount, 0), 0),
    COALESCE(o."paidAt", o."deliveredAt", o."updatedAt", o."createdAt"),
    CURRENT_TIMESTAMP
FROM "Order" AS o
LEFT JOIN (
    SELECT "orderId", SUM(amount)::int AS amount
    FROM "OrderPayment"
    GROUP BY "orderId"
) AS paid ON paid."orderId" = o.id
WHERE o."canceledAt" IS NULL
  AND o.status IS DISTINCT FROM 'CANCELADO'
  AND (
    o.type = 'ESPECIAL'
    OR o.status IN ('PAGADO', 'ENVIADO', 'ENTREGADO')
  )
  AND GREATEST(o.total - COALESCE(paid.amount, 0), 0) > 0;
