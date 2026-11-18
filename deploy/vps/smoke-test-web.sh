#!/usr/bin/env bash
# smoke-test-web.sh <https://www.dominio>
# Comprueba el proxy de Vercel y la página pública. Sin credenciales.
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
BASE="${1:-}"
[[ -n "$BASE" ]] || die "Uso: bash ./smoke-test-web.sh https://www.luxtimee.com"
BASE="${BASE%/}"

pass=0
fail=0
check() {
  local name="$1"
  shift
  if "$@"; then
    printf '✓ %s\n' "$name"
    pass=$((pass + 1))
  else
    printf '✗ %s\n' "$name"
    fail=$((fail + 1))
  fi
}

check "GET /api/v1/health vía Vercel" \
  curl -fsS --max-time 20 -o /dev/null "${BASE}/api/v1/health"

check "GET /catalogo 200" \
  curl -fsS --max-time 20 -o /dev/null "${BASE}/catalogo"

printf '\nResumen: %s OK, %s fallos\n' "$pass" "$fail"
printf '\nPruebas MANUALES (no automatizables):\n'
printf '  - Login admin: %s/acceso/dev-portal-lx9k2\n' "$BASE"
printf '  - Subir una foto de reloj (Inventario) y verla en Cloudinary\n'
printf '  - Venta POS (solo si PR #31 está desplegado y migrado)\n'
printf '  - docker compose logs --tail=100 api sin errores repetidos\n'
[[ "$fail" -eq 0 ]]
