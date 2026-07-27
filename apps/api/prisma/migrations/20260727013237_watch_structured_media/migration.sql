/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Product` table. All the data in the column will be lost.
  - Added the required column `primaryImageUrl` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secondaryImageUrl` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `videoUrl` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "imageUrl",
ADD COLUMN     "primaryImageUrl" TEXT NOT NULL,
ADD COLUMN     "secondaryImageUrl" TEXT NOT NULL,
ADD COLUMN     "videoUrl" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Watch" ADD COLUMN     "primaryImageUrl" TEXT,
ADD COLUMN     "secondaryImageUrl" TEXT,
ADD COLUMN     "videoUrl" TEXT;
