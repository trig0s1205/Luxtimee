-- CreateEnum
CREATE TYPE "WarrantyHistoryStatus" AS ENUM ('VENTA_ENTREGADA', 'GARANTIA_REGISTRADA');
CREATE TYPE "WarrantyReplacementType" AS ENUM ('SAME_WATCH', 'OTHER_WATCH');

-- CreateTable
CREATE TABLE "WarrantyHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "customerPhone" TEXT,
    "productSku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "serviceDate" TIMESTAMP(3),
    "damageDescription" TEXT,
    "replacementType" "WarrantyReplacementType",
    "replacementSku" TEXT,
    "replacementNotes" TEXT,
    "status" "WarrantyHistoryStatus" NOT NULL DEFAULT 'VENTA_ENTREGADA',
    "registeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyHistory_orderItemId_key" ON "WarrantyHistory"("orderItemId");
CREATE INDEX "WarrantyHistory_saleDate_idx" ON "WarrantyHistory"("saleDate");
CREATE INDEX "WarrantyHistory_serviceDate_idx" ON "WarrantyHistory"("serviceDate");
CREATE INDEX "WarrantyHistory_status_idx" ON "WarrantyHistory"("status");
CREATE INDEX "WarrantyHistory_productSku_idx" ON "WarrantyHistory"("productSku");
CREATE INDEX "WarrantyHistory_customerName_idx" ON "WarrantyHistory"("customerName");

-- AddForeignKey
ALTER TABLE "WarrantyHistory" ADD CONSTRAINT "WarrantyHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarrantyHistory" ADD CONSTRAINT "WarrantyHistory_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarrantyHistory" ADD CONSTRAINT "WarrantyHistory_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
