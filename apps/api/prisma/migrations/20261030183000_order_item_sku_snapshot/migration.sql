-- El SKU del reloj puede cambiar de prefijo si cambia el precio o el género.
-- El pedido guarda el código que tenía la pieza en el momento de la venta.
-- Las garantías ya tienen su propio productSku y no se reescriben.

ALTER TABLE "OrderItem" ADD COLUMN "productSku" TEXT;

UPDATE "OrderItem" AS oi
SET "productSku" = w.sku
FROM "Watch" AS w
WHERE oi."watchId" = w.id
  AND oi."productSku" IS NULL;

UPDATE "OrderItem"
SET "productSku" = 'SIN-SKU'
WHERE "productSku" IS NULL;

ALTER TABLE "OrderItem" ALTER COLUMN "productSku" SET NOT NULL;

CREATE INDEX "OrderItem_productSku_idx" ON "OrderItem"("productSku");

-- Recalcula el prefijo (RD / RM / RA / RP) y conserva el consecutivo.
-- Si el destino ya existe, esa fila se resuelve al siguiente número libre.
DROP TABLE IF EXISTS sku_recompute_plan;

CREATE TEMP TABLE sku_recompute_plan AS
SELECT
  w.id,
  w.sku AS old_sku,
  CASE
    WHEN lower(btrim(coalesce(w.gender, ''))) IN ('mujer', 'dama') THEN 'RD'
    WHEN w."retailPrice" <= 80000 THEN 'RM'
    WHEN w."retailPrice" <= 100000 THEN 'RA'
    ELSE 'RP'
  END AS prefix,
  (regexp_match(upper(w.sku), '^[A-Z]{2}-([0-9]+)$'))[1]::int AS seq
FROM "Watch" AS w;

UPDATE "Watch" AS w
SET sku = 'TMP-' || w.id
FROM sku_recompute_plan AS p
WHERE w.id = p.id
  AND p.seq IS NOT NULL
  AND split_part(upper(p.old_sku), '-', 1) <> p.prefix;

WITH candidates AS (
  SELECT
    p.id,
    p.prefix || '-' || CASE
      WHEN length(p.seq::text) >= 3 THEN p.seq::text
      ELSE lpad(p.seq::text, 3, '0')
    END AS new_sku,
    row_number() OVER (PARTITION BY p.prefix, p.seq ORDER BY p.id) AS rn
  FROM sku_recompute_plan AS p
  JOIN "Watch" AS w ON w.id = p.id
  WHERE w.sku LIKE 'TMP-%'
    AND p.seq IS NOT NULL
)
UPDATE "Watch" AS w
SET sku = c.new_sku
FROM candidates AS c
WHERE w.id = c.id
  AND c.rn = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "Watch" AS other
    WHERE other.sku = c.new_sku
      AND other.id <> w.id
  );

WITH parked AS (
  SELECT
    w.id,
    p.prefix,
    row_number() OVER (PARTITION BY p.prefix ORDER BY p.seq NULLS LAST, w.id) AS n
  FROM "Watch" AS w
  JOIN sku_recompute_plan AS p ON p.id = w.id
  WHERE w.sku LIKE 'TMP-%'
),
maxes AS (
  SELECT
    split_part(upper(sku), '-', 1) AS prefix,
    MAX((regexp_match(upper(sku), '^[A-Z]{2}-([0-9]+)$'))[1]::int) AS max_seq
  FROM "Watch"
  WHERE upper(sku) ~ '^[A-Z]{2}-[0-9]+$'
  GROUP BY 1
)
UPDATE "Watch" AS w
SET sku = parked.prefix || '-' || CASE
  WHEN length((COALESCE(maxes.max_seq, 0) + parked.n)::text) >= 3
    THEN (COALESCE(maxes.max_seq, 0) + parked.n)::text
  ELSE lpad((COALESCE(maxes.max_seq, 0) + parked.n)::text, 3, '0')
END
FROM parked
LEFT JOIN maxes ON maxes.prefix = parked.prefix
WHERE w.id = parked.id;

DROP TABLE IF EXISTS sku_recompute_plan;
