ALTER TABLE "Order" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "preOrderActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Order"
SET "preOrderActiveAt" = "createdAt"
WHERE "preOrderActiveAt" IS NULL;

CREATE INDEX "Order_stage_suspendedAt_preOrderActiveAt_idx" ON "Order"("stage", "suspendedAt", "preOrderActiveAt");
