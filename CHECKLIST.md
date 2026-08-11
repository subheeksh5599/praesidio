# VIGILUM — Confidential Guardian for FAssets Vaults

Checklist. Ticks are added ONLY when a task is genuinely done AND verified against the live chain / real execution — never pre-ticked. All deployment values come from env; no mock data, no simulation, no hardcoded addresses in contracts.

## A. Feasibility (verified facts the build depends on)

- [x] A1 FAssets agent system resolved on Coston2 — entry point is fAsset.assetManager() (diamond 0xc1Ca88b9); AgentVaultFactory, AgentOwnerRegistry, CollateralPoolFactory pinned (docs/addresses.md)
- [x] A2 Real vaults read live — 4 available; vault 0x55c815... : owner, 16.86 C2FLR vault collateral, liquidation factors 0 (healthy; non-zero = liquidatable)
- [x] A3 FTSO v2 XRP/USD live read verified — raw 1013869 = $1.013869 (6 decimals)
- [ ] A4 FCC extension scaffold (flare-foundation/fce-extension-scaffold) builds and deploys on Coston2
- [ ] A5 Confirm the TEE-signed action -> on-chain verification path (what the enclave signs, what the contract verifies)
- [ ] A6 Faucet plan for the live E2E (C2FLR, once per address)

## B. Contracts (Solidity, Foundry)

- [x] B1 forge scaffold + foundry.toml (solc 0.8.28, via_ir, optimizer 200)
- [x] B2 GuardianRegistry — register, policy storage, TEE signer registry
- [x] B3 GuardPolicy — thresholds + top-up policy + active flag + pause
- [x] B4 AuditLedger — action records (type, amount, nonce, ts) + ECDSA signature binding
- [x] B5 Vault health reads — IAssetManager interface; AssetManager resolved via fAsset.assetManager() (verified live on Coston2)
- [x] B6 Security — signer-only posting, per-guard nonce, low-s malleability guard, zero-address guards, pause (all tested)
- [x] B7 Unit tests — 18/18 green incl. revert paths; MockAssetManager labeled test-only
- [x] B8 forge fmt clean + gas snapshot committed
- [x] B9 Deploy script — env-only (FASSET, GUARDIAN_SIGNER), resolves AssetManager at runtime

## C. TEE extension (Flare Confidential Compute)

- [x] C1 Go guard service from the FCC scaffold — GUARD op with CHECK_VAULT handler
- [x] C2 Defense logic — liquidation factors (real on-chain signal) -> TOP_UP_REQUIRED / WATCH
- [x] C3 Enclave signing — ECDSA over the registry digest (chainId, guardId, type, amount, nonce) with GUARDIAN_KEY (env)
- [x] C4 Attestation — tee-node wraps the result (scaffold infra); signer address included in every signed action
- [ ] C5 Extension deployed + registered on Coston2 (TeeExtensionRegistry) — TODO: docker/registration path
- [ ] C6 Execution mode stated honestly (real TEE or clearly-labeled simulated mode) — TODO: with C5

## D. Backend services (Node, viem)

- [x] D1 Monitor — live reads verified: vault 0x55c815..., 16.86 C2FLR, factors 0, XRP/USD $1.0143
- [ ] D2 Relayer — written (postAction); live test pending the registry deploy (F)
- [x] D3 Audit reads — monitor.mjs reads getActions(guardId) from the registry
- [x] D4 .env.example complete; env-required values (ASSET_MANAGER, GUARDIAN_REGISTRY, FTSO_V2, RELAYER_PK, GUARDIAN_KEY); only protocol constants defaulted

## E. Frontend (Next.js, ONE URL, light mode, no emoji, no sliders, no logo)

- [ ] E1 Landing — simple, easy UX, technical-only copy, honest claims
- [ ] E2 Console WATCH — live vault health from the chain (real reads, honest offline state)
- [ ] E3 Console DEFEND — policy settings, real transactions (wallet connect -> set policy)
- [ ] E4 Console PROVE — audit log read from the chain (real records, explorer links)
- [ ] E5 Wallet connect + auto Coston2 switch (chain params served from API env)
- [ ] E6 Loading/error/empty states; zero mock data anywhere
- [ ] E7 next build green + browser-verified rendering (layout geometry checked)

## F. Live E2E on Coston2 (centerpiece — REAL transactions)

- [ ] F1 GuardianRegistry deployed (real, registry-resolved)
- [ ] F2 Agent vault registered with a real policy transaction
- [ ] F3 Monitor shows REAL collateralization + live price
- [ ] F4 Defense action executed (TEE-signed, relayed) — real transaction on-chain
- [ ] F5 Audit record verifiable on the explorer (address + tx links)
- [ ] F6 Evidence chain recorded in README/CHECKLIST with explorer links

## G. Deploy & repo

- [ ] G1 GitHub repo (subheeksh5599/vigilum) — public, description, topics, website URL
- [ ] G2 Vercel deploy (manual --prod) with production envs
- [ ] G3 Secret sweep before push — no keys, no .env, no build artifacts

## H. Docs

- [ ] H1 README — simple words + graph, spec-accurate (audited vs code + live behavior), honest limits
- [ ] H2 TRUST_MODEL — what the TEE signs, what the contract verifies, trust assumptions, key custody
- [ ] H3 docs/addresses.md — deployed addresses + complete env list
- [ ] H4 README/checklist ticks only where verified

## I. Submission prep (user's lane where noted)

- [ ] I1 Demo script (local-only, click-steps, no sliders)
- [ ] I2 Submission draft (local-only): what existed before vs what was newly built, separated
- [ ] I3 Traction move in the Flare community

## Human actions

- [ ] J1 Faucet C2FLR for the live E2E (one claim per address)
