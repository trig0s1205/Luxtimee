-- Hash de los enlaces mayoristas ya emitidos (sha256 hex, UTF-8).
-- El token en claro deja de guardarse. Los enlaces y cookies actuales siguen
-- válidos porque la búsqueda usa el mismo hash. El panel no puede volver a
-- mostrar el token; hay que regenerarlo para copiar uno nuevo.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "WholesaleAccess" ADD COLUMN "accessTokenHash" TEXT;
ALTER TABLE "WholesaleAccess" ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "WholesaleAccess"
SET "accessTokenHash" = encode(digest(convert_to("accessToken", 'UTF8'), 'sha256'), 'hex')
WHERE "accessTokenHash" IS NULL;

ALTER TABLE "WholesaleAccess" ALTER COLUMN "accessTokenHash" SET NOT NULL;

DROP INDEX IF EXISTS "WholesaleAccess_accessToken_key";
DROP INDEX IF EXISTS "WholesaleAccess_accessToken_idx";

ALTER TABLE "WholesaleAccess" DROP COLUMN "accessToken";

CREATE UNIQUE INDEX "WholesaleAccess_accessTokenHash_key" ON "WholesaleAccess"("accessTokenHash");
CREATE INDEX "WholesaleAccess_expiresAt_idx" ON "WholesaleAccess"("expiresAt");
CREATE INDEX "Order_wholesaleAccessId_idx" ON "Order"("wholesaleAccessId");
