-- DropIndex
DROP INDEX "Watch_showInCatalog_idx";

-- AlterTable
ALTER TABLE "Watch" ALTER COLUMN "functions" DROP DEFAULT,
ALTER COLUMN "images" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
