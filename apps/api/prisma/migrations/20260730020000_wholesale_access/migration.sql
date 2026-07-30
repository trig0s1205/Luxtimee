-- CreateTable
CREATE TABLE "WholesaleAccess" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "accessToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastAccessAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleAccess_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "wholesaleAccessId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleAccess_accessToken_key" ON "WholesaleAccess"("accessToken");
CREATE INDEX "WholesaleAccess_email_idx" ON "WholesaleAccess"("email");
CREATE INDEX "WholesaleAccess_accessToken_idx" ON "WholesaleAccess"("accessToken");
CREATE INDEX "WholesaleAccess_isActive_idx" ON "WholesaleAccess"("isActive");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_wholesaleAccessId_fkey" FOREIGN KEY ("wholesaleAccessId") REFERENCES "WholesaleAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WholesaleAccess" ADD CONSTRAINT "WholesaleAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
