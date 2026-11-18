#!/usr/bin/env bash
# deploy.sh <tag> — fija API_IMAGE, pull y up -d; espera healthy.
# Uso: bash ./deploy.sh sha-abcdef…   o   bash ./deploy.sh local-20261114-1200
# Guarda el tag anterior en ~/luxtimee/.last-good-image para rollback.sh.
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
cd "${HOME}/luxtimee"
TAG="${1:-}"
[[ -n "$TAG" ]] || die "Uso: bash ./deploy.sh <tag>  (sha-… o local-…)"
[[ "$TAG" == sha-* || "$TAG" == local-* || "$TAG" == ghcr.io/* ]] \
  || die "El tag debe empezar por sha-, local- o ser una referencia ghcr.io/…"

ENV_FILE=.env
[[ -f "$ENV_FILE" ]] || die "Falta .env"

CURRENT="$(grep -E '^API_IMAGE=' "$ENV_FILE" | cut -d= -f2- || true)"
if [[ -n "$CURRENT" ]]; then
  printf '%s\n' "$CURRENT" >.last-good-image
  chmod 600 .last-good-image
fi

if [[ "$TAG" == ghcr.io/* ]]; then
  NEW_IMAGE="$TAG"
elif [[ "$TAG" == local-* ]]; then
  NEW_IMAGE="luxtimee-api:${TAG}"
else
  NEW_IMAGE="ghcr.io/trig0s1205/luxtimee-api:${TAG}"
fi

# Actualizar API_IMAGE sin romper el resto del .env
tmp="$(mktemp)"
awk -v img="$NEW_IMAGE" '
  BEGIN{done=0}
  /^API_IMAGE=/ { print "API_IMAGE=" img; done=1; next }
  { print }
  END { if (!done) print "API_IMAGE=" img }
' "$ENV_FILE" >"$tmp"
mv "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

printf 'Desplegando %s …\n' "$NEW_IMAGE"
if [[ "$NEW_IMAGE" == ghcr.io/* ]]; then
  docker compose pull api
fi
docker compose up -d

printf 'Esperando healthy (hasta 120 s)…\n'
ok=0
for _ in $(seq 1 24); do
  if docker compose ps | grep -E 'api.*healthy' >/dev/null 2>&1; then
    ok=1
    break
  fi
  cid="$(docker compose ps -q api 2>/dev/null || true)"
  if [[ -n "$cid" ]]; then
    h="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$cid" 2>/dev/null || true)"
    [[ "$h" == "healthy" ]] && { ok=1; break; }
  fi
  sleep 5
done

if [[ "$ok" -ne 1 ]]; then
  printf 'La API no quedó healthy. Últimos logs:\n' >&2
  docker compose logs --tail=80 api >&2 || true
  printf '\nPuedes revertir con: bash ./rollback.sh\n' >&2
  exit 1
fi

printf 'OK: API healthy con %s\n' "$NEW_IMAGE"
