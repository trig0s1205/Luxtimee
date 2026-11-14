#!/usr/bin/env bash
# harden-ssh.sh — endurece SSH DESPUÉS de verificar ssh deploy@IP en otra terminal.
# Uso (como root): bash /home/deploy/luxtimee/harden-ssh.sh
set -euo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || die "Debe ejecutarse como root/sudo."

printf 'Antes de continuar, confirma en OTRA terminal: ssh deploy@<IP> funciona.\n'
printf 'Escribe exactamente: ENTRO COMO DEPLOY\n> '
read -r confirm
[[ "$confirm" == "ENTRO COMO DEPLOY" ]] || die "Confirmación incorrecta. Abortado."

CONF=/etc/ssh/sshd_config.d/00-luxtimee-hardening.conf
cat >"$CONF" <<'EOF'
# Prefijo 00: en Ubuntu 24.04 50-cloud-init.conf puede dejar PasswordAuthentication yes.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
EOF

if ! sshd -t; then
  rm -f "$CONF"
  die "sshd -t falló; se eliminó $CONF sin recargar."
fi

systemctl reload ssh
printf '\nValores efectivos:\n'
sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|maxauthtries'
printf '\nListo. Desde ahora solo entra con: ssh deploy@<IP>\n'
