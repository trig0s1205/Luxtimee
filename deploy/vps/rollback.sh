#!/usr/bin/env bash
# rollback.sh — restaura API_IMAGE desde .last-good-image y levanta la API.
# Importante: rollback de CÓDIGO ≠ rollback de BASE DE DATOS.
# Las migraciones de este proyecto son aditivas: el código anterior sigue
# funcionando con la base nueva. Restaurar un .dump solo con corrupción real
# y por decisión explícita de Daniel.
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
cd "${HOME}/luxtimee"
[[ -f .last-good-image ]] || die "No hay .last-good-image. Nada que revertir."
PREV="$(tr -d '\r\n' <.last-good-image)"
[[ -n "$PREV" ]] || die ".last-good-image vacío"

tmp="$(mktemp)"
awk -v img="$PREV" '
  BEGIN{done=0}
  /^API_IMAGE=/ { print "API_IMAGE=" img; done=1; next }
  { print }
  END { if (!done) print "API_IMAGE=" img }
' .env >"$tmp"
mv "$tmp" .env
chmod 600 .env

printf 'Revirtiendo a %s …\n' "$PREV"
if [[ "$PREV" == ghcr.io/* ]]; then
  docker compose pull api || true
fi
docker compose up -d api

ok=0
for _ in $(seq 1 24); do
  cid="$(docker compose ps -q api 2>/dev/null || true)"
  if [[ -n "$cid" ]]; then
    h="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$cid" 2>/dev/null || true)"
    [[ "$h" == "healthy" ]] && { ok=1; break; }
  fi
  sleep 5
done

[[ "$ok" -eq 1 ]] || die "Rollback: la API no quedó healthy. Revisa docker compose logs api"
printf 'OK: rollback a %s\n' "$PREV"
