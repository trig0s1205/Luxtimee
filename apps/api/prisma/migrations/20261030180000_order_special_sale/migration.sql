-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'ESPECIAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "specialNote" TEXT,
ADD COLUMN "specialSalePrice" INTEGER,
ADD COLUMN "specialCostSnapshot" INTEGER,
ADD COLUMN "specialListPriceSnapshot" INTEGER,
ADD COLUMN "specialSkuSnapshot" TEXT,
ADD COLUMN "specialProfit" INTEGER;
