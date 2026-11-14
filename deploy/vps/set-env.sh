#!/usr/bin/env bash
# set-env.sh — genera ~/luxtimee/.env (600) desde .env.production.example.
# Interactivo. Secretos con read -rs (sin eco). Nunca imprime valores secretos.
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
DIR="${HOME}/luxtimee"
EXAMPLE="${DIR}/.env.production.example"
OUT="${DIR}/.env"
[[ -f "$EXAMPLE" ]] || die "Falta $EXAMPLE"
mkdir -p "$DIR"

is_secret_key() {
  local k="$1"
  [[ "$k" == *SECRET* || "$k" == *PASSWORD* || "$k" == *TOKEN* || "$k" == *_KEY || "$k" == *_KEY_* ]] \
    || [[ "$k" == DATABASE_URL || "$k" == DIRECT_URL || "$k" == SMTP_PASS || "$k" == GA4_PRIVATE_KEY ]]
}

urlencode() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.stdin.read().rstrip("\n"), safe=""))'
}

prompt_db_url() {
  local which="$1" # DATABASE_URL | DIRECT_URL
  printf '\n%s — ¿pegar URL completa ya codificada? [u] o armar por partes [p]: ' "$which"
  read -r mode
  if [[ "$mode" == "u" || "$mode" == "U" ]]; then
    printf 'Pega la URL (se ocultará): '
    read -rs url
    printf '\n'
    printf '%s' "$url"
    return
  fi
  printf 'Usuario: '; read -r user
  printf 'Contraseña (oculta): '; read -rs pass; printf '\n'
  printf 'Host: '; read -r host
  printf 'Puerto [%s]: ' "$([[ "$which" == DATABASE_URL ]] && echo 6543 || echo 5432)"
  read -r port
  if [[ -z "$port" ]]; then
    port="$([[ "$which" == DATABASE_URL ]] && echo 6543 || echo 5432)"
  fi
  printf 'Base [postgres]: '; read -r db
  db="${db:-postgres}"
  enc="$(printf '%s' "$pass" | urlencode)"
  url="postgresql://${user}:${enc}@${host}:${port}/${db}"
  if [[ "$which" == DATABASE_URL && "$url" != *"pgbouncer=true"* ]]; then
    if [[ "$url" == *"?"* ]]; then url="${url}&pgbouncer=true"; else url="${url}?pgbouncer=true"; fi
  fi
  printf '%s' "$url"
}

if [[ -f "$OUT" ]]; then
  printf 'Ya existe .env. ¿Reemplazar? [s/N]: '
  read -r ans
  [[ "$ans" == "s" || "$ans" == "S" ]] || die "Abortado."
  bak="${OUT}.bak.$(date -u +%Y%m%d%H%M%S)"
  cp -a "$OUT" "$bak"
  chmod 600 "$bak"
  printf 'Copia de seguridad: %s\n' "$bak"
fi

TMP="$(mktemp)"

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ -z "$line" || "$line" == \#* ]]; then
    printf '%s\n' "$line" >>"$TMP"
    continue
  fi
  key="${line%%=*}"
  def="${line#*=}"
  if is_secret_key "$key"; then
    if [[ "$key" == DATABASE_URL || "$key" == DIRECT_URL ]]; then
      val="$(prompt_db_url "$key")"
    elif [[ "$key" == JWT_SECRET || "$key" == JWT_REFRESH_SECRET || "$key" == CRON_SECRET ]]; then
      printf '%s — [g]=generar automático, [p]=pegar: ' "$key"
      read -r choice
      if [[ "$choice" == "g" || "$choice" == "G" ]]; then
        val="$(openssl rand -hex 48)"
        printf '  (generado; no se muestra)\n'
      else
        printf 'Valor (oculto): '; read -rs val; printf '\n'
      fi
    elif [[ "$key" == CLIENT_IP_SECRET ]]; then
      printf '%s debe ser IGUAL a NUXT_CLIENT_IP_SECRET de Vercel.\n' "$key"
      printf '[p]=pegar el de Vercel, [g]=generar (luego cópialo a Vercel): '
      read -r choice
      if [[ "$choice" == "g" || "$choice" == "G" ]]; then
        val="$(openssl rand -hex 32)"
        printf '  Generado. Después: grep CLIENT_IP_SECRET ~/luxtimee/.env  (tú lo pegas en Vercel).\n'
      else
        printf 'Valor (oculto): '; read -rs val; printf '\n'
      fi
    else
      printf '%s (opcional, Enter=vacío, oculto): ' "$key"
      read -rs val
      printf '\n'
      val="${val:-$def}"
    fi
  else
    printf '%s [%s]: ' "$key" "$def"
    read -r val
    val="${val:-$def}"
  fi
  printf '%s=%s\n' "$key" "$val" >>"$TMP"
done <"$EXAMPLE"

# Validaciones
getv() { grep -E "^$1=" "$TMP" | cut -d= -f2- | tr -d '\r'; }
[[ "$(getv NODE_ENV)" == production ]] || { rm -f "$TMP"; die "NODE_ENV debe ser production"; }
[[ "$(getv USE_MOCKS)" == false ]] || { rm -f "$TMP"; die "USE_MOCKS debe ser false"; }
front="$(getv FRONTEND_URL)"
[[ "$front" == https://* ]] || { rm -f "$TMP"; die "FRONTEND_URL debe empezar con https://"; }
db="$(getv DATABASE_URL)"; dir="$(getv DIRECT_URL)"
[[ "$db" == postgresql://* || "$db" == postgres://* ]] || { rm -f "$TMP"; die "DATABASE_URL inválida"; }
[[ "$dir" == postgresql://* || "$dir" == postgres://* ]] || { rm -f "$TMP"; die "DIRECT_URL inválida"; }
[[ "$db" != *localhost* && "$db" != *127.0.0.1* ]] || { rm -f "$TMP"; die "DATABASE_URL no puede ser localhost"; }
[[ "$dir" != *localhost* && "$dir" != *127.0.0.1* ]] || { rm -f "$TMP"; die "DIRECT_URL no puede ser localhost"; }
jwt="$(getv JWT_SECRET)"
[[ ${#jwt} -ge 32 ]] || { rm -f "$TMP"; die "JWT_SECRET debe tener ≥ 32 caracteres"; }
[[ -n "$(getv CLOUDINARY_CLOUD_NAME)" && -n "$(getv CLOUDINARY_API_KEY)" && -n "$(getv CLOUDINARY_API_SECRET)" ]] \
  || { rm -f "$TMP"; die "CLOUDINARY_* obligatorios"; }

mv "$TMP" "$OUT"
chmod 600 "$OUT"

printf '\nResumen (solo nombres):\n'
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"; val="${line#*=}"
  if [[ -n "$val" ]]; then printf '  ✓ %s\n' "$key"; else printf '  ✗ %s (vacío)\n' "$key"; fi
done <"$OUT"
printf '\n.env escrito en %s (permisos 600). Valores secretos NO se muestran.\n' "$OUT"
