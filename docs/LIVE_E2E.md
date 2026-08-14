# PRAESIDIO — running the live loop (Coston2)

The product loop is: registry guards → TEE checks each vault → enclave signs a
defense action when the vault is liquidatable → the guardian service relays the
signed action on-chain → the PROVE tab shows the ledger. This file is the exact
runbook to bring it up against the deployed registry.

## Deployed (live on Coston2)

- GuardianRegistry: `0xc657e19857630e74d1ea468c141d89ce8459c44e`
- Enclave signer: `0x095b2B51f0Fe4317D0E8A34D2526c42dDE6a61BE`
- Registry owner (deployer): `0x10e82f880De906756D4a3ECB1553756E7bC64D79`

## Prerequisites

- Go 1.26, Node 22+, Foundry
- An enclave key whose address is the registry's `guardianSigner` (set at deploy)
- A relayer EOA funded with C2FLR (gas) — the faucet is
  https://faucet.flare.network/coston2
- One registered guard, i.e. an agent vault YOU own (the registry verifies
  `getAgentVaultOwner(vault) == msg.sender` against the AssetManager)

## 1. Enclave key + signer

```bash
# Generate once; keep GUARDIAN_KEY inside the confidential VM, never in the repo.
cast wallet new            # -> address (guardianSigner) + private_key (GUARDIAN_KEY)
```

## 2. Start the TEE guard

```bash
cd tee/go
go build -o /tmp/praesidio-tee ./cmd/main.go

export COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
export ASSET_MANAGER=0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA
export FTSO_V2=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
export GUARDIAN_REGISTRY=0xc657e19857630e74d1ea468c141d89ce8459c44e
export GUARDIAN_KEY=<enclave key>   # == guardianSigner's private key
export CHAIN_ID=114
/tmp/praesidio-tee                   # listens on :8080

# Sanity: GET /state, and POST /guard/check with a real vault
curl -s -X POST http://127.0.0.1:8080/guard/check \
  -H 'content-type: application/json' \
  -d '{"agentVault":"0x55c815260cBE6c45Fe5bFe5FF32E3C7D746f14dC","guardId":1}'
# -> {"healthy":true,...,"decision":"WATCH"}
```

## 3. Start the guardian service

```bash
cd backend
npm install
export COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
export ASSET_MANAGER=0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA
export GUARDIAN_REGISTRY=0xc657e19857630e74d1ea468c141d89ce8459c44e
export FTSO_V2=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d
export RELAYER_PK=<relayer key>
export TEE_URL=http://127.0.0.1:8080
node service.mjs

# Health: curl http://127.0.0.1:9000/health
```

## 4. Register a guard (needs a vault you own)

```bash
# From the vault owner's wallet (the Defend tab does this in the browser):
#   registerAgentVault(vault, ratioBIPS, topUpAmountWei)
cast send --rpc-url $COSTON2_RPC_URL --private-key $VAULT_OWNER_PK \
  0xc657e19857630e74d1ea468c141d89ce8459c44e \
  "registerAgentVault(address,uint64,uint256)" \
  0x<your-vault> 11000 5000000000000000000
```

## 5. What happens next

The service polls the registry, calls the TEE for each active guard, and when
the guard reports `TOP_UP_REQUIRED` (non-zero liquidation factors) the service
posts the enclave-signed action. Every action is an `ActionPosted` event; read
the full ledger via `getActions(guardId)` — the PROVE tab shows it in the browser.

## Boundaries (honest)

- Creating an agent vault is an FAssets flow (FDC AddressValidity attestation +
  collateral deposit) and is not automatable from a bare laptop. Until a guard
  is registered, the loop runs in WATCH mode (real reads, no signed actions).
- The TEE guard currently runs as ordinary Go with the key from env. Registering
  the extension with the TeeExtensionRegistry and running a real enclave is the
  remaining confidential-compute step (clearly labeled in the README).
