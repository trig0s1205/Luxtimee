-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "customerEmail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountReason" TEXT,
ADD COLUMN "posIdempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_posIdempotencyKey_key" ON "Order"("posIdempotencyKey");

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;
