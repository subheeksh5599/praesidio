# PRAESIDIO — always-on host deployment

Runs the TEE guard + the guardian service 24/7 as systemd units. The
confidential leg has one hardware prerequisite documented at the bottom.

## Layout on the host

```
/opt/praesidio/
├── praesidio-tee        # built tee binary (tee/go/cmd/main.go)
└── backend/             # the backend/ directory (service.mjs + node_modules)
/etc/praesidio/
├── tee.env              # guard env (GUARDIAN_KEY, GUARDIAN_REGISTRY, ...)
└── service.env          # relay env (RELAYER_PK, GUARDIAN_REGISTRY, TEE_URL, ...)
```

## Setup (one-time)

```bash
# 1. Copy the repo, build the tee binary, install backend deps
sudo mkdir -p /opt/praesidio
cd /opt/praesidio
git clone https://github.com/subheeksh5599/praesidio .
cd tee/go && go build -o /opt/praesidio/praesidio-tee ./cmd/main.go
cd /opt/praesidio/backend && npm install --omit=dev

# 2. Env files (chmod 600, root-owned — they hold keys)
sudo mkdir -p /etc/praesidio
sudo tee /etc/praesidio/tee.env >/dev/null <<'EOF'
COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
ASSET_MANAGER=0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA
FTSO_V2=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
GUARDIAN_REGISTRY=0xc657e19857630e74d1ea468c141d89ce8459c44e
GUARDIAN_KEY=<enclave key>
CHAIN_ID=114
EOF
sudo tee /etc/praesidio/service.env >/dev/null <<'EOF'
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
ASSET_MANAGER=0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA
GUARDIAN_REGISTRY=0xc657e19857630e74d1ea468c141d89ce8459c44e
FTSO_V2=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
RELAYER_PK=<relayer key>
TEE_URL=http://127.0.0.1:8080
HEALTH_PORT=9000
EOF
sudo chmod 600 /etc/praesidio/*.env

# 3. Install units
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now praesidio-tee praesidio-guardian

# 4. Verify
curl -s http://127.0.0.1:8080/state     # TEE state
curl -s http://127.0.0.1:9000/health    # guardian service health
```

## Confidential-compute prerequisite (honest)

The TEE guard runs as ordinary Go with the key from env until the extension is
registered with a real Flare Confidential Space VM. That step needs, per the
FCC scaffold's own deployment docs (`tee/docs/deployment-steps.md`):

1. A GCP Confidential Space VM (AMD SEV) running the extension image
2. VPN access to Flare's indexer DB
3. `MODE=0` (production attestation) at image build, not the scaffold's
   `MODE=1` simulated default

On-chain extension registration (deploy `InstructionSender` + `registerExtension`
on the FlareTeeManager) is scripted in `tee/scripts/pre-build.sh` and can run
from any funded key; only the VM hand-off is external. Until that VM exists, the
guardian service's `TEE_URL` points at the local relay endpoint and the README
honesty table stays "⚠️ Pending".
