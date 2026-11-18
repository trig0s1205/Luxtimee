#!/usr/bin/env bash
# set-env.sh — genera ~/luxtimee/.env (600) desde .env.production.example.
# Interactivo. Secretos con read -rs (sin eco). Nunca imprime valores secretos.
# Las respuestas se leen de /dev/tty: stdin puede no ser una terminal (pegado o pipe).
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# -r /dev/tty solo mira permisos del device. Hay que abrirlo: sin terminal de
# control falla con ENXIO aunque el nodo exista.
if ! true 2>/dev/null </dev/tty; then
  die "Se necesita una terminal (/dev/tty). Ejemplo: ssh -t deploy@<IP>"
fi

DIR="${HOME}/luxtimee"
EXAMPLE="${DIR}/.env.production.example"
OUT="${DIR}/.env"
[[ -f "$EXAMPLE" ]] || die "Falta $EXAMPLE"
mkdir -p "$DIR"

# Obligatorias según la plantilla y la validación final. El resto puede ir vacío.
is_required_key() {
  case "$1" in
    NODE_ENV|USE_MOCKS|PORT|HOST|FRONTEND_URL|STAFF_LOGIN_SLUG|COOKIE_SAME_SITE|\
    JWT_ACCESS_EXPIRES|JWT_REFRESH_EXPIRES|CLOUDINARY_FOLDER|NODE_OPTIONS|\
    API_DOMAIN|ACME_EMAIL|API_IMAGE|DATABASE_URL|DIRECT_URL|\
    JWT_SECRET|JWT_REFRESH_SECRET|CLIENT_IP_SECRET|CRON_SECRET|\
    GOOGLE_OAUTH_CALLBACK_URL|\
    CLOUDINARY_CLOUD_NAME|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_secret_key() {
  local k="$1"
  [[ "$k" == *SECRET* || "$k" == *PASSWORD* || "$k" == *TOKEN* || "$k" == *_KEY || "$k" == *_KEY_* ]] \
    || [[ "$k" == DATABASE_URL || "$k" == DIRECT_URL || "$k" == SMTP_PASS || "$k" == GA4_PRIVATE_KEY ]]
}

# stdout: solo el valor. Se usa dentro de $(...).
urlencode() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.stdin.read().rstrip("\n"), safe=""))'
}

# stdout: solo la URL. Los prompts van a stderr porque se usa val="$(prompt_db_url ...)".
prompt_db_url() {
  local which="$1"
  local mode="" url="" user="" pass="" host="" port="" db="" enc=""
  local default_port=5432
  if [[ "$which" == DATABASE_URL ]]; then
    default_port=6543
  fi
  while true; do
    url=""
    printf '\n%s — ¿pegar URL completa ya codificada? [u] o armar por partes [p]: ' "$which" >&2
    read -r mode </dev/tty
    if [[ "$mode" == "u" || "$mode" == "U" ]]; then
      printf 'Pega la URL (se ocultará): ' >&2
      read -rs url </dev/tty
      printf '\n' >&2
    else
      printf 'Usuario: ' >&2
      read -r user </dev/tty
      printf 'Contraseña (oculta): ' >&2
      read -rs pass </dev/tty
      printf '\n' >&2
      printf 'Host: ' >&2
      read -r host </dev/tty
      printf 'Puerto [%s]: ' "$default_port" >&2
      read -r port </dev/tty
      if [[ -z "$port" ]]; then
        port="$default_port"
      fi
      printf 'Base [postgres]: ' >&2
      read -r db </dev/tty
      db="${db:-postgres}"
      enc="$(printf '%s' "$pass" | urlencode)"
      url="postgresql://${user}:${enc}@${host}:${port}/${db}"
      if [[ "$which" == DATABASE_URL && "$url" != *"pgbouncer=true"* ]]; then
        if [[ "$url" == *"?"* ]]; then
          url="${url}&pgbouncer=true"
        else
          url="${url}?pgbouncer=true"
        fi
      fi
    fi
    if [[ -n "$url" ]]; then
      printf '%s' "$url"
      return 0
    fi
    printf '  %s es obligatorio.\n' "$which" >&2
  done
}

if [[ -f "$OUT" ]]; then
  printf 'Ya existe .env. ¿Reemplazar? [s/N]: '
  read -r ans </dev/tty
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
  val=""
  if is_secret_key "$key"; then
    if [[ "$key" == DATABASE_URL || "$key" == DIRECT_URL ]]; then
      val="$(prompt_db_url "$key")"
    elif [[ "$key" == JWT_SECRET || "$key" == JWT_REFRESH_SECRET || "$key" == CRON_SECRET ]]; then
      while true; do
        printf '%s — [g]=generar automático, [p]=pegar: ' "$key"
        read -r choice </dev/tty
        if [[ "$choice" == "g" || "$choice" == "G" ]]; then
          val="$(openssl rand -hex 48)"
          printf '  (generado; no se muestra)\n'
          break
        fi
        printf 'Valor (oculto): '
        read -rs val </dev/tty
        printf '\n'
        if [[ -z "$val" ]]; then
          printf '  %s es obligatorio.\n' "$key" >&2
          continue
        fi
        if [[ "$key" == JWT_SECRET && ${#val} -lt 32 ]]; then
          printf '  JWT_SECRET debe tener ≥ 32 caracteres.\n' >&2
          continue
        fi
        break
      done
    elif [[ "$key" == CLIENT_IP_SECRET ]]; then
      printf '%s debe ser IGUAL a NUXT_CLIENT_IP_SECRET de Vercel.\n' "$key"
      while true; do
        printf '[p]=pegar el de Vercel, [g]=generar (luego cópialo a Vercel): '
        read -r choice </dev/tty
        if [[ "$choice" == "g" || "$choice" == "G" ]]; then
          val="$(openssl rand -hex 32)"
          printf '  Generado. Después: grep CLIENT_IP_SECRET ~/luxtimee/.env  (tú lo pegas en Vercel).\n'
          break
        fi
        printf 'Valor (oculto): '
        read -rs val </dev/tty
        printf '\n'
        if [[ -n "$val" ]]; then
          break
        fi
        printf '  %s es obligatorio.\n' "$key" >&2
      done
    elif is_required_key "$key"; then
      while true; do
        printf '%s (obligatorio, oculto): ' "$key"
        read -rs val </dev/tty
        printf '\n'
        if [[ -n "$val" ]]; then
          break
        fi
        printf '  %s es obligatorio.\n' "$key" >&2
      done
    else
      printf '%s (opcional, Enter=vacío, oculto): ' "$key"
      read -rs val </dev/tty
      printf '\n'
      val="${val:-$def}"
    fi
  else
    while true; do
      printf '%s [%s]: ' "$key" "$def"
      read -r val </dev/tty
      val="${val:-$def}"
      if is_required_key "$key" && [[ -z "$val" ]]; then
        printf '  %s es obligatorio.\n' "$key" >&2
        continue
      fi
      break
    done
  fi
  printf '%s=%s\n' "$key" "$val" >>"$TMP"
done <"$EXAMPLE"

# stdout: solo el valor. Se usa dentro de $(...).
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
