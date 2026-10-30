-- Búsqueda de inventario sin distinguir mayúsculas ni tildes.
-- pg_trgm permite que el LIKE '%término%' use índice en vez de recorrer la tabla.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION luxtime_fold(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    lower(coalesce(input, '')),
    'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ',
    'aaaaaaeeeeiiiiooooouuuuncyy'
  );
$$;

CREATE INDEX IF NOT EXISTS "Watch_model_fold_trgm_idx"
  ON "Watch" USING gin (luxtime_fold("model") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Watch_sku_fold_trgm_idx"
  ON "Watch" USING gin (luxtime_fold("sku") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Watch_reference_fold_trgm_idx"
  ON "Watch" USING gin (luxtime_fold("reference") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Brand_name_fold_trgm_idx"
  ON "Brand" USING gin (luxtime_fold("name") gin_trgm_ops);
