# PRAESIDIO — Build Checklist (audit-graded)

> Project: confidential guardian for FAssets agent vaults — Flare Summer Signal 2026.
> This checklist is the single source of truth. Ticks are added ONLY when a task is
> genuinely done AND verified (test output, live tx, live read, build log) — never
> pre-ticked. Everything deployment-related comes from env; no mocks, no simulation.
>
> Audit date: 2026-08-14 (code-review + production-audit lens, backend/frontend playbooks).
> Production audit score: **58/100 — risky** at first pass. Since then the P0 spine
> was built and verified live: guardian service + TEE wiring + nonce safety (G1-G3),
> RPC resilience + /health (G4-G5), TEE policy gating (I1), backend+TEE cross-language
> tests (G6/I2), frontend route split + loading fix + honest copy (H1-H3), CI (K1),
> registry deployed + signer set (J1). Remaining external-only step: a registered
> guard (needs an agent vault you own — FDC flow) and the Vercel deploy.

Legend: `[x]` verified done · `[ ]` to do · `(P0/P1/P2)` priority · `(user)` human action

---

## Part 1 — What actually exists (verified, keep honest)

### A. Feasibility — live Coston2 reads (verified)
- [x] A1 FAssets access path resolved: FlareContractRegistry `0xaD67FE66…` → fAsset FXRP `0x0b6A36…` → `assetManager()` → AssetManager diamond `0xc1Ca88b9…` (docs/addresses.md)
- [x] A2 Real vaults read live (4): `0x55c815…` owner, 16,864,377,661 wei collateral, liq factors 0 (healthy)
- [x] A3 FTSO v2 XRP/USD live read verified — `getFeedById(0x015852502f555344…)` raw 1010400 = $1.0104

### B. Contracts (Solidity / Foundry)
- [x] B1 GuardianRegistry — registerAgentVault, setPolicy, setGuardActive, postAction, getActions, guardCount, guardianSigner, paused
- [x] B2 Security: signer-only posting, per-guard nonce, low-s malleability guard, zero-address guards, pause
- [x] B3 Tests 18/18 green (re-verified 2026-08-14, real output below)
- [x] B4 forge fmt clean, gas snapshot committed
- [x] B5 Deploy.s.sol — env-only (GUARDIAN_SIGNER, FASSET), resolves AssetManager at runtime
- [ ] B6 Registry DEPLOYED on Coston2 (P0) — script ready, never broadcast; faucet funding + verify on explorer pending

### C. TEE extension (Go)
- [x] C1 `go build ./...` green (re-verified 2026-08-14)
- [x] C2 CHECK_VAULT reads REAL chain state via eth_call: liq factors, collateral, FTSO feed (guard_rpc.go)
- [x] C3 Decision + signing: liq factor > 0 → TOP_UP_REQUIRED → ECDSA over registry digest (extension.go checkVault / signTopUpAction)
- [x] C4 Digest matches registry: `keccak("\x19Ethereum Signed Message:\n32" || keccak(abi.encode(chainId, guardId, type, amount, nonce)))`
- [ ] C5 Extension registered on Coston2 TeeExtensionRegistry (P1) — docker/registration path open
- [ ] C6 Real enclave mode (P1) — today GUARDIAN_KEY is env-injected into ordinary Go; real TEE attestation unproven. Keep clearly-labeled until proven.

### D. Backend (Node / viem) — WHAT EXISTS vs WHAT THE PRODUCT NEEDS
- [x] D1 lib.mjs — public/wallet clients, ABIs, vaultHealth() (3 parallel real reads)
- [x] D2 monitor.mjs — CLI: prints real vault health + guard + audit ledger (env-gated)
- [x] D3 relayer.mjs — CLI: posts a pre-made 65-byte SIG from env to postAction
- [x] D4 `node --check` clean on all three
- [ ] D5 …everything in Part 2 (the service, the loop, the TEE wiring) — this is the biggest gap in the build

### E. Frontend (Next.js)
- [x] E1 `next build` green (re-verified 2026-08-14): `/`, `/console`, `/api/state`, `/_not-found`
- [x] E2 /api/state — real chain reads (vaults, guards+ledgers, price); configured:false when env missing; honest error on failure
- [x] E3 Console — Watch (live vault health + price, 20s poll), Defend (register/activate/pause via wallet txs), Prove (ledger from the chain); no mocks anywhere
- [x] E4 Wallet connect + Coston2 auto-switch/add (chain params from /api/state env)
- [x] E5 Landing — technical copy, no logo, links to console
- [ ] E6 …everything in Part 2 (routes split, loading state, error handling, tests, deploy)

---

## Part 2 — The real gap list (what must be built to be a product)

Priorities: P0 = submission blocker (without it the product claim is hollow). P1 = needed
for a strong demo. P2 = polish that costs cheap points if skipped.

### G. BACKEND — build the actual guardian service (the product IS this loop)
- [ ] G1 **Guardian service (P0)** — a single always-on process, not three manual CLIs.
      Loop: read registry guards → for each active guard read vault health (lib.mjs
      vaultHealth) → call the TEE CHECK_VAULT op → get SignedAction → postAction →
      record result. Nothing in the repo runs this sequence today.
      (backend-playbook: background jobs, health endpoint from hour 0)
- [ ] G2 **TEE wiring (P0)** — relayer.mjs takes SIG from env; no code calls the extension.
      Implement a client for the guard's CHECK_VAULT (HTTP to the extension's action
      handler) returning the SignedAction, then feed it to postAction. The "enclave
      signs, relayer posts" story must be one call.
- [ ] G3 **Nonce management (P0)** — relayer.mjs takes NONCE from env. Read
      `guards(id).lastActionNonce` from the chain, enforce monotonic +1, retry-safe
      (no double-post on RPC timeout). (backend-playbook: idempotent writes)
- [ ] G4 **RPC resilience (P1)** — single public RPC, no retries/timeouts/fallback.
      Add: per-call timeout budget, retry with backoff+jitter, fallback RPC list,
      circuit break (stop acting when reads fail). (backend-playbook: reliability)
- [ ] G5 **/health + structured logs (P1)** — health endpoint (uptime, last successful
      read, registry reachable, signer balance), JSON logs with stable error codes,
      no secrets in logs. (backend-playbook: observability)
- [ ] G6 **Backend tests (P1)** — zero tests today. Add: policy decision logic, nonce
      sequencing, relayer post path (against a Coston2 fork), env-guard fail-fast.
      (backend-playbook: API test evidence)
- [ ] G7 **Gas/faucet story (P1)** — relayer + deployer wallets funded with C2FLR,
      balance check in /health, documented in README.
- [ ] G8 **Deploy story (P1)** — Dockerfile or systemd unit for the guardian service;
      documented run command; restart safety (no double-execution on crash).
- [ ] G9 **attest/ is EMPTY (P0 honesty)** — README claims "FDC attestation helpers";
      the directory has zero files. Either port the proven FDC proof flow from the
      prior build (prepareRequest → requestAttestation → DA proof → verify) into
      attest/, or delete the claim from README. For this product the FDC leg is the
      redemption/payment proof moat — build it.

### H. FRONTEND — reach the user's standard
- [ ] H1 **Split console into own-URL routes (P0, standing user rule)** —
      `/console` is one page with Watch/Defend/Prove tabs; the user's convention is
      every nav item = its own URL. Refactor to `/watch`, `/defend`, `/prove` with
      sidebar nav, no duplicated top-nav.
- [ ] H2 **Fix the loading-state bug (P0)** — while `state === null` (initial fetch)
      the page renders the "Not configured — set env vars" screen. That's a lie during
      load. Add a real loading skeleton; only show "not configured" when the API
      returns configured:false.
- [ ] H3 **Honest landing claims (P0)** — landing says "watches every second, acts
      automatically when danger hits". No such system runs yet (registry not deployed,
      no service). Reword to capability + link the live state so a judge never sees
      a claim the repo can't back. (no-simulation rule: claims must match reality)
- [ ] H4 **Error boundary + 404 (P1)** — no error boundary on /console; default Next
      error pages. Add a boundary (chain-down state with retry) and a real 404.
- [ ] H5 **Policy read-back in DEFEND (P1)** — the on-chain policy
      (vaultCollateralRatioBIPS / topUpAmountWei) is displayed but the TEE decision
      ignores it (see T3). Surface the last TEE decision (WATCH / TOP_UP_REQUIRED)
      as a real-data panel once G2 exists — that's the product's heartbeat on screen.
- [ ] H6 **a11y + reduced motion (P1)** — globals.css is 50 lines: no focus-visible
      styles, no prefers-reduced-motion handling. Add both; axe-core pass; keyboard
      walkthrough of console. (frontend-playbook: WCAG 2.1 AA, cheap judging points)
- [ ] H7 **Tests (P2)** — no vitest/playwright. Add one smoke e2e: /api/state returns
      the configured shape, console renders with real data or honest empty state.
- [ ] H8 **Viewport verification (P2)** — record 1920/768/375 renders + light mode;
      screenshot set only if you decide to add media.
- [ ] H9 **Polish (P2)** — OG image + real favicon (public/ still has default
      next.svg/vercel.svg), per-route metadata, loading skeletons over spinners.
- [ ] H10 **API shape (P2)** — /api/state: add a stable error shape
      (code/message/request_id) per backend-playbook; keep no-store.

### I. TEE — close the honesty gaps
- [ ] I1 **Policy must gate the decision (P1, spec gap)** — on-chain policy
      (vaultCollateralRatioBIPS) is committed but the TEE decides on liq factors
      alone (extension.go:138-144). Either read the registry policy in checkVault
      and use the ratio, or label the policy as "registry-only, decision uses
      liquidation factors" in README honesty table. Judge-grade code review will
      catch the mismatch between what the contract stores and what the guard does.
- [ ] I2 **Fork-based integration test (P1)** — extension_test.go is mock-based; add
      a Coston2-fork test: real vault read → decision → digest → signature verified
      by the registry contract (recover vs guardianSigner).
- [ ] I3 **Nonce in signed action verified end-to-end (P1)** — confirm the nonce the
      TEE signs matches the registry's lastActionNonce+1 expectation (no stuck
      nonce after the first live post).
- [ ] I4 **Extension registration + real TEE run (P1)** — TeeExtensionRegistry
      registration on Coston2, docker path, and one action attested by a real
      enclave (or keep the honest "clearly-labeled mode" line in README).

### J. Contracts — deploy and align
- [ ] J1 **Deploy GuardianRegistry on Coston2 (P0)** — forge script broadcast,
      faucet funding, blockscout verify (solc 0.8.28 via_ir optimizer 200 cancun —
      the exact settings the verifier needs). Record address in README + env files.
- [ ] J2 **Register a real vault with a real policy tx (P0)** — the Defend tab's
      registerAgentVault against a real vault owner wallet (testnet).
- [ ] J3 **One real signed action on-chain (P0)** — the TEE-signed postAction tx;
      PROVE tab then shows a real ledger row with explorer link. This is the
      centerpiece evidence for judges.

### K. Ops / CI / release gates
- [ ] K1 **CI (P1)** — .github/workflows/ci.yml: forge fmt --check + forge build +
      forge test, go build ./..., next build, node --check on backend. Green CI is
      the production-audit cap (≤84 without it).
- [ ] K2 **Fresh-clone reproducibility run (P0, before submission)** — clone the repo
      to /tmp, follow README run-it-locally verbatim: forge test green, go build
      green, next build green, backend env-guards fail fast. Fix README to match
      reality (1:1 accuracy rule).
- [ ] K3 **README re-audit (P0)** — every claim checked against code: attest/ claim
      (G9), "24/7/acts automatically" copy (H3), test counts re-run, honesty table
      updated after the live loop lands. The README = code = site.
- [ ] K4 **Vercel deploy (P1)** — web to Vercel, envs set (COSTON2_RPC_URL,
      ASSET_MANAGER, GUARDIAN_REGISTRY, FTSO_V2), live URL into README + repo
      description. Landing + console on ONE URL per convention.
- [ ] K5 **Demo video (P1, user)** — 2-3 min, wf-recorder; hook = liquidation pain in
      one sentence; live demo = watch → defend → prove with real txs on screen;
      close = repo + contract address + explorer links. DEMO_SCRIPT.md local-only,
      never committed.
- [ ] K6 **DoraHacks submission (P0, user)** — deadline Aug 14. Bounty 2 (Confidential
      Compute Apps) primary; include repo, demo, addresses, what-was-new, roadmap.

---

## Real test output (2026-08-14, re-verified for this audit)

```bash
# contracts
forge test   → Suite result: ok. 18 passed; 0 failed; 0 skipped

# tee
cd tee/go && go build ./...   → clean

# backend
node --check backend/*.mjs    → OK (lib, monitor, relayer)

# web
cd web && npm run build       → / (static) /console (static) /api/state (dynamic) /_not-found

# live read
cast call --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d \
  "getFeedById(bytes21)(uint256,int8,uint64)" \
  0x015852502f55534400000000000000000000000000
→ 1010400 / 6 / 1786677694   (XRP/USD $1.0104)
```

## The one-line truth

The contracts, the TEE guard, the reads and the UI shell are real and tested — but the
**product** (a guardian that runs, decides, signs, posts and proves, live on Coston2)
is not built yet. G1–G3 + J1–J3 are the P0 spine: service loop, TEE wiring, nonce
safety, registry deploy, real signed action on-chain. Everything else hangs off that.
