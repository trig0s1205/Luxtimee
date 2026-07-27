ALTER TABLE "Watch" ADD COLUMN "showInCatalog" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Watch_showInCatalog_idx" ON "Watch"("showInCatalog");
