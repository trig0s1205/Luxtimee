-- CreateTable
CREATE TABLE "PackagingPhoto" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" VARCHAR(80),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackagingPhoto_sortOrder_idx" ON "PackagingPhoto"("sortOrder");
