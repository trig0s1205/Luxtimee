#!/usr/bin/env bash
# backup-supabase.sh — pg_dump -Fc de producción vía DIRECT_URL (antes de migrar).
# Uso (como deploy): cd ~/luxtimee && bash ./backup-supabase.sh
# Solo lee DIRECT_URL con grep (NO hace source del .env).
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
ENV_FILE="${HOME}/luxtimee/.env"
[[ -f "$ENV_FILE" ]] || die "No existe $ENV_FILE"

DIRECT_URL="$(grep -E '^DIRECT_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
[[ -n "$DIRECT_URL" ]] || die "DIRECT_URL vacío"
[[ "$DIRECT_URL" == postgresql://* || "$DIRECT_URL" == postgres://* ]] \
  || die "DIRECT_URL debe empezar con postgresql://"
if [[ "$DIRECT_URL" == *"localhost"* || "$DIRECT_URL" == *"127.0.0.1"* || "$DIRECT_URL" == *"host.docker.internal"* ]]; then
  [[ "${ALLOW_LOCAL_DB:-}" == "1" ]] \
    || die "DIRECT_URL parece local. Solo para pruebas: ALLOW_LOCAL_DB=1 bash ./backup-supabase.sh"
  printf 'AVISO: backup contra base LOCAL (ALLOW_LOCAL_DB=1).\n' >&2
fi

# Cliente Postgres 17 (alineado con .github/workflows/db-backup.yml)
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
BACKUP_DIR="${HOME}/backups"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y-%m-%d-%H%M)"
OUT="${BACKUP_DIR}/luxtimee-${STAMP}.dump"

printf 'Comprobando conexión (SHOW server_version)…\n'
if ! docker run --rm -e PGPASSWORD_UNUSED=1 "$PG_IMAGE" \
  psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -tAc 'SHOW server_version;' ; then
  cat >&2 <<'EOF'
No se pudo conectar. Causas frecuentes:
  - DIRECT_URL usa transaction pooler (debe ser Direct o Session, puerto 5432)
  - El host es solo IPv6 y el contenedor no tiene IPv6: usa Session pooler (IPv4)
  - Contraseña mal codificada en la URL (%24 para $, %40 para @, etc.)
EOF
  exit 1
fi

printf 'Generando dump…\n'
docker run --rm -v "${BACKUP_DIR}:/backups" "$PG_IMAGE" \
  pg_dump "$DIRECT_URL" -Fc --no-owner --no-privileges -f "/backups/luxtimee-${STAMP}.dump"
chmod 600 "$OUT"

SIZE="$(wc -c <"$OUT" | tr -d ' ')"
if [[ "$SIZE" -lt 10240 ]]; then
  die "El dump pesa ${SIZE} bytes (< 10 KB). Algo falló."
fi

printf 'Tamaño: %s bytes\n' "$SIZE"
printf 'Contenido (primeras líneas):\n'
docker run --rm -v "${BACKUP_DIR}:/backups" "$PG_IMAGE" \
  pg_restore --list "/backups/luxtimee-${STAMP}.dump" | head -n 20 || true

HOST_HINT="$(hostname -I 2>/dev/null | awk '{print $1}')"
printf '\nCopia al PC (PowerShell):\n'
printf '  scp deploy@%s:%s .\n' "${HOST_HINT:-<IP>}" "$OUT"
printf '\nRestaurar SOLO en base de PRUEBA (nunca encima de producción sin decisión de Daniel).\n'
printf 'Dump listo: %s\n' "$OUT"
