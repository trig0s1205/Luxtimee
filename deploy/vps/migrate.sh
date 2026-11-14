#!/usr/bin/env bash
# migrate.sh — prisma migrate status|deploy usando el CLI de la imagen API.
# Uso (como deploy):
#   bash ./migrate.sh status
#   bash ./migrate.sh deploy
# Comando validado: ./node_modules/.bin/prisma … --schema prisma/schema.prisma
# ADVERTENCIA: solo aplican las migraciones que trae la IMAGEN en API_IMAGE.
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
cd "${HOME}/luxtimee"
[[ -f .env ]] || die "Falta .env"
[[ -f docker-compose.yml ]] || die "Falta docker-compose.yml"

CMD="${1:-}"
[[ "$CMD" == "status" || "$CMD" == "deploy" ]] || die "Uso: bash ./migrate.sh status|deploy"

PRISMA_CMD='./node_modules/.bin/prisma'
run_prisma() {
  local sub="$1"
  docker compose run --rm --no-deps --entrypoint sh api -c \
    "${PRISMA_CMD} migrate ${sub} --schema prisma/schema.prisma"
}

if [[ "$CMD" == "status" ]]; then
  run_prisma status
  exit 0
fi

# deploy: exigir backup reciente (< 2 h)
LATEST_DUMP="$(find "${HOME}/backups" -name 'luxtimee-*.dump' -mmin -120 2>/dev/null | sort | tail -n 1 || true)"
[[ -n "$LATEST_DUMP" ]] || die "No hay .dump de las últimas 2 horas en ~/backups. Corre bash ./backup-supabase.sh primero."

printf 'Backup reciente: %s\n' "$LATEST_DUMP"
printf '\n--- Estado actual ---\n'
run_prisma status || true
printf '\nSolo se aplicarán migraciones incluidas en API_IMAGE=%s\n' \
  "$(grep -E '^API_IMAGE=' .env | cut -d= -f2-)"
printf 'Si la imagen sale de main SIN el PR #31, la migración del POS no se aplica.\n'
printf 'Escribe MIGRAR para continuar: '
read -r confirm
[[ "$confirm" == "MIGRAR" ]] || die "Abortado."

run_prisma deploy
printf '\n--- Estado final ---\n'
run_prisma status
printf '\nNunca uses migrate dev / db push / migrate reset en producción.\n'
