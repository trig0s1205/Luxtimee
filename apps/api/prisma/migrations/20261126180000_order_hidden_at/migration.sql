-- AlterTable
ALTER TABLE "Order" ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "hiddenById" TEXT;

-- CreateIndex
CREATE INDEX "Order_hiddenAt_idx" ON "Order"("hiddenAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
