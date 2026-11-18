-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DATAFONO_BOLD', 'NO_ESPECIFICADO');

-- CreateEnum
CREATE TYPE "ReceiptChannel" AS ENUM ('WEB', 'LOCAL');

-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('RECIBIDO', 'EN_REVISION', 'REPARADO', 'REEMPLAZADO', 'RECHAZADO', 'ENTREGADO');

-- CreateEnum
CREATE TYPE "ExpenseOrigin" AS ENUM ('PLATAFORMA', 'LOCAL');

-- AlterEnum
ALTER TYPE "OrderSource" ADD VALUE 'LOCAL';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VENDEDOR_LOCAL';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "origin" "ExpenseOrigin" NOT NULL DEFAULT 'PLATAFORMA';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerDocument" TEXT,
ADD COLUMN     "sellerId" TEXT;

-- AlterTable
ALTER TABLE "OrderPayment" ADD COLUMN     "cardLast4" VARCHAR(4),
ADD COLUMN     "cashReceived" INTEGER,
ADD COLUMN     "changeGiven" INTEGER,
ADD COLUMN     "method" "PaymentMethod",
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "DocumentCounter" (
    "key" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SaleReceipt" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "orderId" TEXT,
    "orderReadableId" TEXT NOT NULL,
    "channel" "ReceiptChannel" NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "backfilled" BOOLEAN NOT NULL DEFAULT false,
    "customerName" TEXT NOT NULL,
    "customerDocument" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "sellerId" TEXT,
    "sellerName" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "shippingCost" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "businessSnapshot" JSONB NOT NULL,
    "warrantyTerms" TEXT NOT NULL,
    "paymentsSnapshot" JSONB NOT NULL,
    "fiscalStatus" TEXT,
    "fiscalProvider" TEXT,
    "fiscalExternalId" TEXT,
    "fiscalPayload" JSONB,

    CONSTRAINT "SaleReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "brandName" TEXT,
    "model" TEXT,
    "reference" TEXT,
    "sku" TEXT NOT NULL,
    "limitedEditionNumber" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "warrantyMonths" INTEGER NOT NULL,
    "warrantyStartsAt" TIMESTAMP(3) NOT NULL,
    "warrantyEndsAt" TIMESTAMP(3),
    "warrantyExtraTerms" TEXT,

    CONSTRAINT "SaleReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReceiptPdf" (
    "receiptId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReceiptPdf_pkey" PRIMARY KEY ("receiptId")
);

-- CreateTable
CREATE TABLE "CashClosing" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "openingCash" INTEGER NOT NULL,
    "countedCash" INTEGER NOT NULL,
    "expectedCash" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "totalCash" INTEGER NOT NULL,
    "totalTransfer" INTEGER NOT NULL,
    "totalCard" INTEGER NOT NULL,
    "totalOther" INTEGER NOT NULL,
    "totalSales" INTEGER NOT NULL,
    "salesCount" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "receiptItemId" TEXT NOT NULL,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'RECIBIDO',
    "reportedIssue" TEXT NOT NULL,
    "notes" TEXT,
    "outOfWarranty" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaimEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromStatus" "WarrantyClaimStatus",
    "toStatus" "WarrantyClaimStatus" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarrantyClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleReceipt_number_key" ON "SaleReceipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReceipt_orderId_key" ON "SaleReceipt"("orderId");

-- CreateIndex
CREATE INDEX "SaleReceipt_saleDate_idx" ON "SaleReceipt"("saleDate");

-- CreateIndex
CREATE INDEX "SaleReceipt_customerPhone_idx" ON "SaleReceipt"("customerPhone");

-- CreateIndex
CREATE INDEX "SaleReceipt_customerDocument_idx" ON "SaleReceipt"("customerDocument");

-- CreateIndex
CREATE INDEX "SaleReceipt_orderReadableId_idx" ON "SaleReceipt"("orderReadableId");

-- CreateIndex
CREATE INDEX "SaleReceiptItem_receiptId_idx" ON "SaleReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "SaleReceiptItem_sku_idx" ON "SaleReceiptItem"("sku");

-- CreateIndex
CREATE INDEX "CashClosing_businessDate_idx" ON "CashClosing"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosing_businessDate_userId_key" ON "CashClosing"("businessDate", "userId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_status_idx" ON "WarrantyClaim"("status");

-- CreateIndex
CREATE INDEX "WarrantyClaim_receiptItemId_idx" ON "WarrantyClaim"("receiptItemId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_createdAt_idx" ON "WarrantyClaim"("createdAt");

-- CreateIndex
CREATE INDEX "WarrantyClaimEvent_claimId_idx" ON "WarrantyClaimEvent"("claimId");

-- CreateIndex
CREATE INDEX "Expense_origin_idx" ON "Expense"("origin");

-- CreateIndex
CREATE INDEX "Order_source_idx" ON "Order"("source");

-- CreateIndex
CREATE INDEX "Order_sellerId_idx" ON "Order"("sellerId");

-- CreateIndex
CREATE INDEX "OrderPayment_method_idx" ON "OrderPayment"("method");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReceipt" ADD CONSTRAINT "SaleReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReceipt" ADD CONSTRAINT "SaleReceipt_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReceiptItem" ADD CONSTRAINT "SaleReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "SaleReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReceiptPdf" ADD CONSTRAINT "SaleReceiptPdf_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "SaleReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "SaleReceiptItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaimEvent" ADD CONSTRAINT "WarrantyClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaimEvent" ADD CONSTRAINT "WarrantyClaimEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
