#!/usr/bin/env bash
# fingerprints-backfill.sh — huellas de fotos ya guardadas en Cloudinary.
# Uso (como deploy, en ~/luxtimee):
#   bash ./fingerprints-backfill.sh status
#   bash ./fingerprints-backfill.sh apply
# status es solo lectura. apply exige backup < 2 h y la palabra HUELLAS.
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
cd "${HOME}/luxtimee"
[[ -f .env ]] || die "Falta .env"
[[ -f docker-compose.yml ]] || die "Falta docker-compose.yml"

CMD="${1:-}"
[[ "$CMD" == "status" || "$CMD" == "apply" ]] || die "Uso: bash ./fingerprints-backfill.sh status|apply"

NODE_CMD='node dist/scripts/backfill-image-fingerprints.prod.js'

run_status() {
  docker compose run --rm --no-deps --entrypoint sh api -c "${NODE_CMD}"
}

run_apply() {
  docker compose run --rm --no-deps --entrypoint sh api -c \
    "CONFIRM_PROD_FINGERPRINTS=SI ${NODE_CMD} --apply"
}

if [[ "$CMD" == "status" ]]; then
  run_status
  exit 0
fi

LATEST_DUMP="$(find "${HOME}/backups" -name 'luxtimee-*.dump' -mmin -120 2>/dev/null | sort | tail -n 1 || true)"
[[ -n "$LATEST_DUMP" ]] || die "No hay .dump de las últimas 2 horas en ~/backups. Corre bash ./backup-supabase.sh primero."

printf 'Backup reciente: %s\n' "$LATEST_DUMP"
printf '\n--- Conteo (dry-run, no escribe) ---\n'
run_status
printf '\nSolo se insertan filas en WatchImageFingerprint. No se modifican fotos ni relojes.\n'
printf 'Imagen: %s\n' "$(grep -E '^API_IMAGE=' .env | cut -d= -f2-)"
if ! true 2>/dev/null </dev/tty; then
  die "Se necesita una terminal (/dev/tty). Ejemplo: ssh -t deploy@<IP>"
fi
printf 'Escribe HUELLAS para continuar: '
read -r confirm </dev/tty
[[ "$confirm" == "HUELLAS" ]] || die "Abortado."

run_apply
printf '\nListo. Revisa el resumen (actualizadas, ya listas, omitidas, fallidas).\n'
