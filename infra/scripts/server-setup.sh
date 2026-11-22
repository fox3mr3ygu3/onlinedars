#!/usr/bin/env bash
# One-time hardening + Docker setup for a fresh Ubuntu 22.04/24.04 LTS server (staging or production).
# Run as root (or with sudo) from your PC:
#   scp infra/scripts/server-setup.sh root@<host>:/root/
#   ssh root@<host> 'DEPLOY_PUBKEY="$(cat)" bash /root/server-setup.sh' < ~/.ssh/onlinedars_deploy.pub
#
# What it does:
#   - creates the "deploy" user (docker group, no password, SSH key only)
#   - SSH: keys only, no root login, no passwords
#   - ufw: allow 22/tcp, 80/tcp, 443/tcp, 443/udp; deny everything else inbound
#   - fail2ban for sshd; unattended security upgrades; small swap file if none
#   - Docker Engine + compose plugin from Docker's apt repo, with log rotation
#   - /opt/onlinedars owned by deploy
#
# Keep your current SSH session open until you've confirmed key login as "deploy" works.
set -Eeuo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/onlinedars}"
SSH_PORT="${SSH_PORT:-22}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
DEPLOY_PUBKEY="${DEPLOY_PUBKEY:-}"

log() { printf '\n==> %s\n' "$*"; }

[[ "$(id -u)" -eq 0 ]] || { echo "run as root" >&2; exit 1; }
[[ -n "$DEPLOY_PUBKEY" ]] || { echo "set DEPLOY_PUBKEY to the deploy user's public key" >&2; exit 1; }
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || { echo "this script targets Ubuntu LTS (found: ${ID:-unknown})" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive

log "system packages"
apt-get update -y
apt-get upgrade -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades apt-listchanges jq

log "deploy user: $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH_KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH_KEYS"
grep -qxF "$DEPLOY_PUBKEY" "$AUTH_KEYS" || printf '%s\n' "$DEPLOY_PUBKEY" >> "$AUTH_KEYS"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"

log "sshd: keys only, no root login"
cat > /etc/ssh/sshd_config.d/10-onlinedars.conf <<EOF
Port ${SSH_PORT}
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
LoginGraceTime 30
AllowUsers ${DEPLOY_USER} ${EXTRA_SSH_USERS:-}
EOF
sshd -t
# Ubuntu 24.04 starts sshd via ssh.socket, which ignores "Port". Use the plain service instead
# when a non-default port is requested.
if [[ "$SSH_PORT" != "22" ]] && systemctl is-active --quiet ssh.socket; then
  systemctl disable --now ssh.socket
  systemctl enable ssh.service
fi
systemctl restart ssh || systemctl restart sshd

log "firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

log "fail2ban"
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
port = ${SSH_PORT}
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

log "unattended security upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades

log "swap"
if ! swapon --show | grep -q .; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-onlinedars.conf
fi

log "docker engine"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Log rotation for every container; live-restore keeps containers up during docker upgrades.
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
EOF
systemctl enable docker
systemctl restart docker
usermod -aG docker "$DEPLOY_USER"

# Docker-published ports bypass ufw. Only Caddy publishes ports (80/443) in
# docker-compose.prod.yml, so this is fine - never publish postgres/redis/minio ports.

log "app directory"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_DIR" "$DEPLOY_DIR/backups" "$DEPLOY_DIR/scripts" "$DEPLOY_DIR/caddy"

log "done"
echo "Next: from your PC run  ssh -p ${SSH_PORT} ${DEPLOY_USER}@<host> docker ps"
echo "Then record the host key for GitHub:  ssh-keyscan -p ${SSH_PORT} -t ed25519 <host>"
