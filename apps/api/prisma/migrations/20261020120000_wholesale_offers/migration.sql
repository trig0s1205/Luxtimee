-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "extrasSnapshot" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "OrderItem" ADD COLUMN "packageId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "packageName" TEXT;

-- CreateTable
CREATE TABLE "WholesaleExtra" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleExtra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WholesalePackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesalePackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WholesalePackageWatch" (
    "packageId" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,

    CONSTRAINT "WholesalePackageWatch_pkey" PRIMARY KEY ("packageId","watchId")
);

CREATE UNIQUE INDEX "WholesaleExtra_name_key" ON "WholesaleExtra"("name");
CREATE INDEX "WholesalePackageWatch_watchId_idx" ON "WholesalePackageWatch"("watchId");

ALTER TABLE "WholesalePackageWatch" ADD CONSTRAINT "WholesalePackageWatch_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "WholesalePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WholesalePackageWatch" ADD CONSTRAINT "WholesalePackageWatch_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WholesaleExtra" ("id", "name", "price", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('wh_extra_pano', 'Paño', 0, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wh_extra_pila', 'Pila', 0, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('wh_extra_caja', 'Caja', 0, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
