# PRAESIDIO — TEE registration runbook (finish on the VPS)

The DB creds are applied and verified. Everything below is already configured
except EXT_PROXY_URL. Run this on the VPS (from your machine — mine is IP-banned).

## 1. What's already done (don't redo)

- config/proxy/extension_proxy.coston2.docker.toml — [db] filled with
  hackathon_user_58 (host 34.38.42.208, db indexer) — VERIFIED, connects, 4 tables.
- tee/.env — SIMULATED_TEE=true, DEPLOYMENT_PRIVATE_KEY, INITIAL_OWNER,
  PROXY_PRIVATE_KEY all set. Only EXT_PROXY_URL is empty.

## 2. The one thing you must provide: a stable HTTPS URL

The proxy MUST be reachable at a stable public HTTPS hostname with a valid cert
(providers POST to /instruction on port 6664). Pick one:

  A) Point a domain/subdomain at the VPS (e.g. tee.yourdomain.com -> 187.127.137.136),
     then Let's Encrypt:  certbot certonly --nginx -d tee.yourdomain.com
  B) Free subdomain (DuckDNS/sslip) + certbot with DNS-01.

Set it:
  echo 'EXT_PROXY_URL=https://tee.yourdomain.com' >> /home/arch/praesidio/tee/.env

## 3. Run the stack + register (single command on the VPS)

  cd /home/arch/praesidio/tee
  bash scripts/use-chain.sh coston2
  docker compose -f docker-compose.yaml -f docker-compose.coston2.yaml up -d
  # wait ~60s for proxy /info to settle, then register the TEE machine:
  bash scripts/post-build.sh
  # verify:
  curl -s https://tee.yourdomain.com/info | jq '{extensionId,codeHash,platform}'
  cd tools && go run ./cmd/query-tee -ext 0x00000000000000000000000000000000000000000000000000000000000102c6 \
    -rpc "https://coston2-api.flare.network/ext/C/rpc"

Expected /info: extensionId matches 0x…102c6, codeHash is the simulated hash
(not 0x194844cf — that's the scaffold default; yours reflects the built image),
platform TEST_PLATFORM (simulated).

## 4. What a pass looks like

query-tee lists one active machine with status PRODUCTION and your URL. Then the
extension is a live, FTDC-attested TEE machine on Coston2 — item #1 ticked
(simulated attestation, which the pinned message confirms is the supported
hackathon path).

## Pitfalls (from the pinned message)

- One machine per endpoint. Don't register several on one URL.
- A restart mints a new teeId. Re-register + pause the stale one after any restart.
- Stable URL only — no temp ngrok/cloudflared quick URLs.
- 404 from FTDC proxy ≠ down; check /action/status/<epoch>/<id>.
