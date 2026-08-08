-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WEB', 'WHATSAPP', 'MAYORISTA');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "deliveryNote" TEXT;
