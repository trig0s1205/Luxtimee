#!/usr/bin/env bash
# ghcr-login.sh — login en GHCR y comprueba que API_IMAGE exista.
# Uso (como deploy): cd ~/luxtimee && bash ./ghcr-login.sh
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
ENV_FILE="${HOME}/luxtimee/.env"
[[ -f "$ENV_FILE" ]] || die "No existe $ENV_FILE. Corre primero bash ./set-env.sh"

API_IMAGE="$(grep -E '^API_IMAGE=' "$ENV_FILE" | cut -d= -f2- || true)"
[[ -n "$API_IMAGE" ]] || die "API_IMAGE vacío en .env"

printf 'Usuario de GitHub: '
read -r GH_USER
[[ -n "$GH_USER" ]] || die "Usuario vacío"
printf 'Token con permiso read:packages (no se muestra): '
read -rs GH_TOKEN
printf '\n'
[[ -n "$GH_TOKEN" ]] || die "Token vacío"

printf '%s\n' "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
unset GH_TOKEN

if ! docker manifest inspect "$API_IMAGE" >/dev/null 2>&1; then
  cat >&2 <<EOF
ERROR: no se encontró la imagen: $API_IMAGE

Cómo generarla:
  1) GitHub → Actions → API image (GHCR) → Run workflow
  2) Elige la rama (main o feat/comprobantes-pos)
  3) Copia el tag sha-<sha completo> del resumen
  4) Ponlo en API_IMAGE dentro de ~/luxtimee/.env
EOF
  exit 1
fi

printf 'OK: login en GHCR y la imagen existe.\n'
