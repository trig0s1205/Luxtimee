-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('DISPONIBLE', 'AGOTADO', 'PROXIMAMENTE', 'DISCONTINUADO');

-- AlterTable
ALTER TABLE "Watch" ADD COLUMN "sku" TEXT,
ADD COLUMN "reference" TEXT,
ADD COLUMN "movementCaliber" TEXT,
ADD COLUMN "caseDiameter" TEXT,
ADD COLUMN "caseMaterial" TEXT,
ADD COLUMN "bezelMaterial" TEXT,
ADD COLUMN "dialColor" TEXT,
ADD COLUMN "crystalType" TEXT,
ADD COLUMN "strapMaterial" TEXT,
ADD COLUMN "waterResistance" TEXT,
ADD COLUMN "functions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "status" "WatchStatus" NOT NULL DEFAULT 'DISPONIBLE',
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isLimitedEdition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "limitedEditionNumber" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "mainImageIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Backfill SKU for existing watches with unique placeholders
UPDATE "Watch"
SET "sku" = 'LUX-LEG-' || substr(md5(random()::text), 1, 6)
WHERE "sku" IS NULL;

-- Make SKU unique and required
ALTER TABLE "Watch" ALTER COLUMN "sku" SET NOT NULL;
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_sku_key" UNIQUE ("sku");

-- CreateIndex
CREATE INDEX "Watch_status_idx" ON "Watch"("status");
CREATE INDEX "Watch_slug_idx" ON "Watch"("slug");
