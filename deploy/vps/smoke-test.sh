#!/usr/bin/env bash
# smoke-test.sh <https://api.dominio> [--insecure]
# Pruebas sin credenciales. --insecure SOLO para pruebas locales (CA de Caddy).
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
BASE="${1:-}"
[[ -n "$BASE" ]] || die "Uso: bash ./smoke-test.sh https://api.luxtimee.com [--insecure]"
BASE="${BASE%/}"
INSECURE=0
[[ "${2:-}" == "--insecure" ]] && INSECURE=1
[[ "$INSECURE" -eq 1 ]] && printf 'AVISO: --insecure solo para pruebas locales.\n' >&2

curl_base() {
  if [[ "$INSECURE" -eq 1 ]]; then
    curl -fsS --max-time 15 -k "$@"
  else
    curl -fsS --max-time 15 "$@"
  fi
}

pass=0
fail=0
ok() { printf '✓ %s\n' "$1"; pass=$((pass + 1)); }
bad() { printf '✗ %s\n' "$1"; fail=$((fail + 1)); }

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Health
code="$(curl_base -o "$TMP" -w '%{http_code}' "${BASE}/api/v1/health" || true)"
if [[ "$code" == "200" ]] && grep -q '"status":"ok"' "$TMP"; then
  ok "GET /api/v1/health 200 + status ok"
else
  bad "GET /api/v1/health 200 + status ok"
fi

# TLS
if [[ "$INSECURE" -eq 1 ]]; then
  ok "Certificado / TLS (omitido con --insecure)"
else
  if curl -fsS --max-time 15 -o /dev/null "${BASE}/api/v1/health"; then
    ok "Certificado / TLS (sin -k en prod)"
  else
    bad "Certificado / TLS (sin -k en prod)"
  fi
fi

# HSTS
if [[ "$INSECURE" -eq 1 ]]; then
  ok "Cabecera Strict-Transport-Security (omitido con --insecure)"
else
  hdrs="$(curl -fsSI --max-time 15 "${BASE}/api/v1/health" || true)"
  if grep -qi 'strict-transport-security' <<<"$hdrs"; then
    ok "Cabecera Strict-Transport-Security"
  else
    bad "Cabecera Strict-Transport-Security"
  fi
fi

# Catalog
code="$(curl_base -o "$TMP" -w '%{http_code}' "${BASE}/api/v1/catalog" || true)"
if [[ "$code" == "200" ]] && [[ -s "$TMP" ]]; then
  ok "GET /api/v1/catalog 200 JSON"
else
  bad "GET /api/v1/catalog 200 JSON"
fi

# CORS allow
curl_base -o /dev/null -D "$TMP" -X OPTIONS "${BASE}/api/v1/auth/login" \
  -H 'Origin: https://www.luxtimee.com' \
  -H 'Access-Control-Request-Method: POST' || true
if grep -qi 'access-control-allow-origin: https://www.luxtimee.com' "$TMP" \
  && grep -qi 'access-control-allow-credentials: true' "$TMP"; then
  ok "CORS preflight Origin www.luxtimee.com"
else
  bad "CORS preflight Origin www.luxtimee.com"
fi

# CORS deny
curl_base -o /dev/null -D "$TMP" -X OPTIONS "${BASE}/api/v1/auth/login" \
  -H 'Origin: https://evil.example' \
  -H 'Access-Control-Request-Method: POST' || true
if ! grep -qi 'access-control-allow-origin: https://evil.example' "$TMP"; then
  ok "CORS rechaza origen ajeno"
else
  bad "CORS rechaza origen ajeno"
fi

# Cron sin secreto
if [[ "$INSECURE" -eq 1 ]]; then
  code="$(curl -sS --max-time 15 -k -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/v1/internal/cron/pre-order-reminders" || true)"
else
  code="$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/v1/internal/cron/pre-order-reminders" || true)"
fi
if [[ "$code" == "403" || "$code" == "401" ]]; then
  ok "Cron sin secreto → ${code}"
else
  bad "Cron sin secreto → 403 (obtuvo ${code})"
fi

printf '\nResumen: %s OK, %s fallos\n' "$pass" "$fail"
printf '\nPruebas manuales (runbook):\n'
printf '  - Login admin /acceso/dev-portal-lx9k2\n'
printf '  - Subir foto de reloj (Cloudinary)\n'
printf '  - Venta POS si PR #31 está desplegado\n'
[[ "$fail" -eq 0 ]]
