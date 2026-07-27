-- Drop the existing default so the column type can be changed
ALTER TABLE "Watch" ALTER COLUMN "status" DROP DEFAULT;

-- Create new simplified enum
CREATE TYPE "WatchStatus_new" AS ENUM ('DISPONIBLE', 'AGOTADO');

-- Convert existing values: obsolete statuses map to active equivalents
ALTER TABLE "Watch" ALTER COLUMN "status" TYPE "WatchStatus_new" USING (
  CASE "status"
    WHEN 'PROXIMAMENTE' THEN 'DISPONIBLE'::"WatchStatus_new"
    WHEN 'DISCONTINUADO' THEN 'AGOTADO'::"WatchStatus_new"
    ELSE "status"::text::"WatchStatus_new"
  END
);

-- Drop old enum
DROP TYPE "WatchStatus";

-- Rename new enum to match Prisma schema
ALTER TYPE "WatchStatus_new" RENAME TO "WatchStatus";

-- Restore default value
ALTER TABLE "Watch" ALTER COLUMN "status" SET DEFAULT 'DISPONIBLE';
