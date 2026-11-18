-- Huellas de fotos de reloj. Solo agrega tabla, columnas anulables e índices.
CREATE TABLE "WatchImageFingerprint" (
    "id" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "contentHash" TEXT,
    "perceptualHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchImageFingerprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchImageFingerprint_watchId_imageUrl_key" ON "WatchImageFingerprint"("watchId", "imageUrl");
CREATE INDEX "WatchImageFingerprint_watchId_idx" ON "WatchImageFingerprint"("watchId");
CREATE INDEX "WatchImageFingerprint_contentHash_idx" ON "WatchImageFingerprint"("contentHash");
CREATE INDEX "WatchImageFingerprint_perceptualHash_idx" ON "WatchImageFingerprint"("perceptualHash");

ALTER TABLE "WatchImageFingerprint" ADD CONSTRAINT "WatchImageFingerprint_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
