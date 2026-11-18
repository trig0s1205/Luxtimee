#!/usr/bin/env bash
# Corre set-env.sh con HOME falso y un TTY simulado.
# stdin del proceso es basura a propósito: las respuestas salen de /dev/tty.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT}/set-env.sh"
REAL_HOME="${HOME}"
command -v python3 >/dev/null

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

SNAP="$(mktemp)"
if [[ -e "${REAL_HOME}/luxtimee" ]]; then
  find "${REAL_HOME}/luxtimee" -printf '%p %T@\n' | sort >"$SNAP"
else
  : >"$SNAP"
fi

# Sin terminal de control debe abortar antes de tocar archivos.
NOTTY="$(mktemp -d)"
set +e
setsid bash "$SCRIPT" </dev/null >"${NOTTY}/out" 2>"${NOTTY}/err"
NOTTY_RC=$?
set -e
[[ "$NOTTY_RC" -ne 0 ]] || fail "sin /dev/tty el script no debe terminar bien"
grep -q '/dev/tty' "${NOTTY}/err" || fail "falta el error de /dev/tty: $(cat "${NOTTY}/err")"

FAKE="$(mktemp -d)"
mkdir -p "${FAKE}/luxtimee"
cat >"${FAKE}/luxtimee/.env.production.example" <<'EOF'
# fixture

NODE_ENV=production
USE_MOCKS=false
FRONTEND_URL=https://www.luxtimee.com
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
JWT_SECRET=CAMBIAR_jwt_access_largo
CLOUDINARY_CLOUD_NAME=CAMBIAR
CLOUDINARY_API_KEY=CAMBIAR
CLOUDINARY_API_SECRET=CAMBIAR
IMAGE_SERVICE_API_KEY=
SENTRY_DSN=
EOF

python3 - "$SCRIPT" "$FAKE" <<'PY'
import os, sys, pty, select, subprocess, fcntl, termios, time

script, home = sys.argv[1], sys.argv[2]
jwt = "0123456789abcdef0123456789abcdef0123456789abcdef"
answers = [
    "", "", "",  # NODE_ENV, USE_MOCKS, FRONTEND_URL (defaults)
    "p", "dbuser", "p@ss:word", "db.example.com", "", "",
    "u", "",  # DIRECT_URL vacía: debe re-preguntar
    "u", "postgresql://dbuser:secret@db.example.com:5432/postgres",
    "p", "short",  # JWT corto: debe re-preguntar
    "p", jwt,
    "luxtime/watches",
    "", "ckey123",  # CLOUDINARY_API_KEY obligatorio
    "csecret123",
    "",  # IMAGE_SERVICE_API_KEY opcional
    "",  # SENTRY_DSN opcional
]

master, slave = pty.openpty()
garbage_r, garbage_w = os.pipe()
os.write(garbage_w, b"GARBAGE_STDIN\n" * 40)
os.close(garbage_w)

def preexec():
    os.setsid()
    fcntl.ioctl(1, termios.TIOCSCTTY, 0)

env = os.environ.copy()
env["HOME"] = home
env["TERM"] = "xterm"
proc = subprocess.Popen(
    ["bash", script],
    stdin=garbage_r,
    stdout=slave,
    stderr=slave,
    preexec_fn=preexec,
    env=env,
    close_fds=True,
)
os.close(garbage_r)
os.close(slave)

out = bytearray()

def drain():
    while True:
        ready, _, _ = select.select([master], [], [], 0.2)
        if not ready:
            if proc.poll() is not None:
                while True:
                    ready2, _, _ = select.select([master], [], [], 0)
                    if not ready2:
                        return
                    try:
                        chunk = os.read(master, 4096)
                    except OSError:
                        return
                    if not chunk:
                        return
                    out.extend(chunk)
            continue
        try:
            chunk = os.read(master, 4096)
        except OSError:
            return
        if not chunk:
            return
        out.extend(chunk)

import threading
thread = threading.Thread(target=drain, daemon=True)
thread.start()
blob = "".join(a + "\n" for a in answers).encode()
view = memoryview(blob)
while view:
    n = os.write(master, view)
    view = view[n:]

try:
    rc = proc.wait(timeout=20)
except subprocess.TimeoutExpired:
    proc.kill()
    proc.wait(timeout=5)
    thread.join(timeout=2)
    sys.stderr.buffer.write(out)
    sys.exit("timeout")
thread.join(timeout=2)
os.close(master)
if rc != 0:
    sys.stderr.buffer.write(out)
    sys.exit(rc)
text = out.decode("utf-8", "replace")
if "es obligatorio" not in text:
    sys.stderr.write(text)
    sys.exit("no re-preguntó un valor obligatorio vacío")
PY

ENVF="${FAKE}/luxtimee/.env"
[[ -f "$ENVF" ]] || fail "no se escribió .env"
[[ "$(stat -c %a "$ENVF")" == "600" ]] || fail "permisos $(stat -c %a "$ENVF"), se esperaba 600"

getv() { grep -E "^$1=" "$ENVF" | cut -d= -f2-; }

DB_EXPECT="postgresql://dbuser:p%40ss%3Aword@db.example.com:6543/postgres?pgbouncer=true"
DIR_EXPECT="postgresql://dbuser:secret@db.example.com:5432/postgres"
JWT_EXPECT="0123456789abcdef0123456789abcdef0123456789abcdef"

[[ "$(getv DATABASE_URL)" == "$DB_EXPECT" ]] || fail "DATABASE_URL=$(getv DATABASE_URL)"
[[ "$(getv DIRECT_URL)" == "$DIR_EXPECT" ]] || fail "DIRECT_URL=$(getv DIRECT_URL)"
[[ "$(getv JWT_SECRET)" == "$JWT_EXPECT" ]] || fail "JWT_SECRET incorrecto"
[[ "$(getv NODE_ENV)" == "production" ]] || fail "NODE_ENV"
[[ "$(getv USE_MOCKS)" == "false" ]] || fail "USE_MOCKS"
[[ "$(getv FRONTEND_URL)" == "https://www.luxtimee.com" ]] || fail "FRONTEND_URL"
[[ "$(getv CLOUDINARY_CLOUD_NAME)" == "luxtime/watches" ]] || fail "CLOUDINARY_CLOUD_NAME"
[[ "$(getv CLOUDINARY_API_KEY)" == "ckey123" ]] || fail "CLOUDINARY_API_KEY=$(getv CLOUDINARY_API_KEY)"
[[ "$(getv CLOUDINARY_API_SECRET)" == "csecret123" ]] || fail "CLOUDINARY_API_SECRET"
[[ -z "$(getv IMAGE_SERVICE_API_KEY)" ]] || fail "IMAGE_SERVICE_API_KEY debía quedar vacío"
[[ -z "$(getv SENTRY_DSN)" ]] || fail "SENTRY_DSN debía quedar vacío"
if grep -q 'pegar\|Usuario\|obligatorio\|opcional\|GARBAGE_STDIN\|Puerto' "$ENVF"; then
  fail "el .env contiene texto de prompt o stdin"
fi

if [[ -e "${REAL_HOME}/luxtimee" ]]; then
  find "${REAL_HOME}/luxtimee" -printf '%p %T@\n' | sort >"${SNAP}.after"
  diff -u "$SNAP" "${SNAP}.after" >/dev/null || fail "tocó ${REAL_HOME}/luxtimee"
fi

rm -rf "$FAKE" "$NOTTY" "$SNAP" "${SNAP}.after"
printf 'OK set-env tty\n'
