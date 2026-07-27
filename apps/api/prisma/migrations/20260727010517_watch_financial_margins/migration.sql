-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPrice" DECIMAL(12,0),
ADD COLUMN     "retailMarginPercentage" DECIMAL(5,2),
ADD COLUMN     "retailPrice" DECIMAL(12,0),
ADD COLUMN     "secretaryCommissionPercentage" DECIMAL(5,2),
ADD COLUMN     "wholesaleMarginPercentage" DECIMAL(5,2),
ADD COLUMN     "wholesalePrice" DECIMAL(12,0);

-- AlterTable
ALTER TABLE "Watch" ADD COLUMN     "retailMarginPercentage" DECIMAL(5,2),
ADD COLUMN     "secretaryCommissionPercentage" DECIMAL(5,2),
ADD COLUMN     "wholesaleMarginPercentage" DECIMAL(5,2);
