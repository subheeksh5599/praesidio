#!/usr/bin/env bash
# PRAESIDIO — one-shot deploy on an always-on host (VPS / bare metal).
# Run as root. Idempotent. Touches NOTHING outside /opt/praesidio, /etc/praesidio,
# and the two systemd units named praesidio-*. No interaction with other services.
#
# Usage (run on the VPS, as root):
#   curl -fsSL https://raw.githubusercontent.com/subheeksh5599/praesidio/master/deploy/install.sh | bash
#   # then edit /etc/praesidio/tee.env and service.env to add the two keys, and:
#   systemctl enable --now praesidio-tee praesidio-guardian
set -euo pipefail

REGISTRY=0xc657e19857630e74d1ea468c141d89ce8459c44e
ASSET_MANAGER=0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA
FTSO_V2=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
RPC=https://coston2-api.flare.network/ext/C/rpc

log() { echo -e "\033[1;32m[praesidio]\033[0m $*"; }
die() { echo -e "\033[1;31m[praesidio] ERROR:\033[0m $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root"

# ---- deps (only if missing; never upgrades system packages) ----
command -v git  >/dev/null || { log "installing git";  apt-get update -qq && apt-get install -y -qq git; }
command -v curl >/dev/null || { log "installing curl"; apt-get update -qq && apt-get install -y -qq curl; }

if ! command -v node >/dev/null 2>&1; then
  log "installing node 22 (nodesource, minimal)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

if ! command -v go >/dev/null 2>&1; then
  log "installing go (tarball to /usr/local)"
  GO_VER=1.26.5
  curl -fsSL "https://go.dev/dl/go${GO_VER}.linux-amd64.tar.gz" -o /tmp/go.tgz
  rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tgz
  echo 'export PATH=$PATH:/usr/local/go/bin' > /etc/profile.d/go.sh
  export PATH="$PATH:/usr/local/go/bin"
fi

# ---- clone + build (idempotent: reset --hard on re-run) ----
mkdir -p /opt/praesidio
cd /opt/praesidio
if [ -d .git ]; then
  git fetch -q origin master && git reset -q --hard origin/master
else
  git clone -q https://github.com/subheeksh5599/praesidio .
fi

log "building TEE guard (go — downloads deps, ~2-4 min)"
cd /opt/praesidio/tee/go && go build -o /opt/praesidio/praesidio-tee ./cmd/main.go

log "installing backend deps (npm, ~1 min)"
cd /opt/praesidio/backend && npm install --omit=dev --no-audit --no-fund

# ---- env files (keys filled by hand; placeholders here) ----
log "writing env files (add the two keys, then enable the units)"
mkdir -p /etc/praesidio
cat > /etc/praesidio/tee.env <<EOF
COSTON2_RPC=${RPC}
ASSET_MANAGER=${ASSET_MANAGER}
FTSO_V2=${FTSO_V2}
GUARDIAN_REGISTRY=${REGISTRY}
GUARDIAN_KEY=<PASTE_ENCLAVE_KEY_HERE>
CHAIN_ID=114
EOF
cat > /etc/praesidio/service.env <<EOF
COSTON2_RPC_URL=${RPC}
ASSET_MANAGER=${ASSET_MANAGER}
GUARDIAN_REGISTRY=${REGISTRY}
FTSO_V2=${FTSO_V2}
RELAYER_PK=<PASTE_RELAYER_KEY_HERE>
TEE_URL=http://127.0.0.1:8080
HEALTH_PORT=9000
EOF
chmod 600 /etc/praesidio/*.env

# ---- systemd units ----
cp /opt/praesidio/deploy/systemd/*.service /etc/systemd/system/
systemctl daemon-reload

log "done. Next steps:"
log "  1. edit /etc/praesidio/tee.env + service.env (add GUARDIAN_KEY + RELAYER_PK)"
log "  2. systemctl enable --now praesidio-tee praesidio-guardian"
log "  3. verify: curl -s http://127.0.0.1:9000/health"
