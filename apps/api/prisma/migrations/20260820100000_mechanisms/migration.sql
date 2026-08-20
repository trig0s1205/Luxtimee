-- CreateTable
CREATE TABLE "Mechanism" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mechanism_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mechanism_name_key" ON "Mechanism"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Mechanism_slug_key" ON "Mechanism"("slug");

-- AlterTable
ALTER TABLE "Watch" ADD COLUMN "mechanismId" TEXT;

-- CreateIndex
CREATE INDEX "Watch_mechanismId_idx" ON "Watch"("mechanismId");

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_mechanismId_fkey" FOREIGN KEY ("mechanismId") REFERENCES "Mechanism"("id") ON DELETE SET NULL ON UPDATE CASCADE;
