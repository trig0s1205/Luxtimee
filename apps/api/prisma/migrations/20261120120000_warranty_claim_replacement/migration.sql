-- Reemplazo de garantía. Solo agrega columnas anulables, índice y FK. No altera ni elimina columnas existentes.
ALTER TABLE "WarrantyClaim" ADD COLUMN "replacementWatchId" TEXT;
ALTER TABLE "WarrantyClaim" ADD COLUMN "replacementSku" TEXT;

CREATE INDEX "WarrantyClaim_replacementWatchId_idx" ON "WarrantyClaim"("replacementWatchId");

ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_replacementWatchId_fkey" FOREIGN KEY ("replacementWatchId") REFERENCES "Watch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
