#!/usr/bin/env bash
# bootstrap-server.sh — prepara un Ubuntu 24.04 recién creado (UNA vez, como root).
# Uso (desde el PC, PowerShell):
#   scp -r .\deploy\vps root@<IP>:/root/luxtimee-deploy
#   ssh -t root@<IP> "sed -i 's/\r$//' /root/luxtimee-deploy/*.sh && bash /root/luxtimee-deploy/bootstrap-server.sh"
# Idempotente: se puede volver a correr.
set -euo pipefail

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "Debe ejecutarse como root."
# shellcheck source=/dev/null
. /etc/os-release
[[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] \
  || die "Se espera Ubuntu 24.04 (encontrado: ${PRETTY_NAME:-desconocido})."

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get -y upgrade
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades jq

if ! id -u deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
install -d -m 0750 /etc/sudoers.d
echo 'deploy ALL=(ALL) NOPASSWD:ALL' >/etc/sudoers.d/90-deploy
chmod 440 /etc/sudoers.d/90-deploy
visudo -cf /etc/sudoers.d/90-deploy >/dev/null

install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
if [[ -f /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
else
  die "No hay /root/.ssh/authorized_keys (llave de Vultr). Abortando."
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    ${VERSION_CODENAME} stable" >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker deploy

cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
EOF
systemctl enable --now docker
systemctl restart docker

if [[ -z "$(swapon --show --noheadings 2>/dev/null || true)" ]]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
sysctl -w vm.swappiness=10 >/dev/null
grep -q 'vm.swappiness' /etc/sysctl.d/99-luxtimee.conf 2>/dev/null \
  || echo 'vm.swappiness=10' >/etc/sysctl.d/99-luxtimee.conf

# Nota: Docker publica puertos saltándose ufw; por eso el compose solo publica 80/443
# y la API usa expose (sin ports al host).
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

systemctl enable --now fail2ban
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST=/home/deploy/luxtimee
install -d -m 755 -o deploy -g deploy "$DEST"
cp -a "$SRC_DIR"/. "$DEST"/
# scp desde Windows: quitar CRLF y asegurar +x
find "$DEST" -type f \( -name '*.sh' -o -name 'Caddyfile' -o -name '*.yml' -o -name '*.example' -o -name '*.md' -o -name '*.cron' -o -name '*.ps1' \) \
  -exec sed -i 's/\r$//' {} +
chmod +x "$DEST"/*.sh
chown -R deploy:deploy "$DEST"

log ""
log "=== Bootstrap listo ==="
log "1) En OTRA terminal: ssh deploy@$(hostname -I | awk '{print $1}')"
log "2) Solo cuando entre bien, en esta sesión root:"
log "   bash /home/deploy/luxtimee/harden-ssh.sh"
log "3) Luego (como deploy): cd ~/luxtimee && bash ./set-env.sh"
log "No desactivamos root todavía: eso lo hace harden-ssh.sh tras confirmar."
