# PRAESIDIO — verified Coston2 addresses (read live)

All verified via `cast call` against Coston2 RPC. The FAssets system is NOT
resolved through FlareContractRegistry by the names in the docs — the entry
point is the fAsset token's `assetManager()`.

## Deployed PRAESIDIO contracts (live 2026-08-14)

| Contract | Address | Notes |
|---|---|---|
| GuardianRegistry | `0xc657e19857630e74d1ea468c141d89ce8459c44e` | deploy tx `0x38bf3270…`; owner + guardianSigner set |
| guardianSigner (enclave key) | `0x095b2B51f0Fe4317D0E8A34D2526c42dDE6a61BE` | the address the TEE signs with |

Registry state verified on-chain: `assetManager = 0xc1Ca88b9…`,
`guardianSigner = 0x095b2B51…`, `guardCount = 0`, `paused = false`,
`owner = 0x10e82f88…` (deployer).

## Flare Confidential Compute registration (live 2026-08-14)

| Artifact | Value | Notes |
|---|---|---|
| Extension ID | `0x…0102c6` (66246) | registered on FlareTeeManager `0x1a9C4A0f…` |
| InstructionSender | `0xE2d10267EABcC068F99ED3173D1F8EF93C3A2819` | deployed; code verified on-chain |
| TEE machine | `0xEd271bce…` — status 2 PRODUCTION | registered + active; URL `https://praesidio.187.127.137.136.sslip.io` (Caddy + Let's Encrypt), FTDC signing policy tracking (init 5938) |

The extension is a registered FCC extension, and its TEE machine is registered
and promoted to PRODUCTION on the FlareTeeManager with simulated testnet
attestation (`SIMULATED_TEE=true`, `TEST_PLATFORM` — the supported Coston2
hackathon path). Real hardware attestation (GCP AMD SEV) remains the
production-only upgrade.

## Access path (verified)

1. FlareContractRegistry (same on all networks): `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`
   - resolves: FdcVerification, FtsoV2, FdcHub, WNat (verified)
2. fAsset (testnet FXRP): `0x0b6A3645c240605887a5532109323A3E12273dc7`
   - `assetManager()` -> AssetManager diamond (verified)
3. AssetManager diamond: `0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA`
   - facets: AgentInfoFacet, AvailableAgentsFacet, MintingFacet, LiquidationFacet,
     AgentSettingsFacet, AgentVaultManagementFacet, SettingsReaderFacet, ...

## FAssets system (from flare-foundation/fassets deployment/deploys/coston2.json)

- AssetManager_FTestXRP (diamond): `0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA`
- FTestXRP (fAsset): `0x0b6A3645c240605887a5532109323A3E12273dc7`
- AgentVaultFactory: `0x7f3a0266666531107058e7a5519c94C046245017`
- AgentOwnerRegistry: `0xAF21eE9C49030e2dE9e8c2Ab7618082cc3d70b42`
- CollateralPoolFactory: `0x53b90F1444469899FCD3920Ff2a9224C7676b2a6`
- AssetManagerController: `0x1C772F700308aF4c13897cc7b9c41EFfB82c50C0`
- FAssetImplementation: `0xEbAc2F4e8306488fCbF07ea42e610DA5B8Cd2643`
- FtsoV2PriceStore (PriceReader): `0x94E33f519E256149752711245EAB2E1abb8c34A4`

## Real agent vaults on Coston2 (available list, verified)

- `0x55c815260cBE6c45Fe5bFe5FF32E3C7D746f14dC` — owner 0x00fA41..., vault collateral 16,864,377,661 wei, liquidation factors 0 (healthy)
- `0xd5dEFe2c62D48788BB3889534FBFe7Aea0602D64`
- `0x5b89514d1F060AdbEA8B7294AFf81ed8dbAa7fC5`
- `0x165c62b4531D28E34c68a8b2aCBF4D0421e4E028`

## Monitor reads (verified working)

- `getAvailableAgentsList(uint256,uint256)(address[])` — list vaults
- `getAgentVaultOwner(address)(address)`
- `getAgentFullVaultCollateral(address)(uint256)`
- `getAgentLiquidationFactorsAndMaxAmount(address)(uint256,uint256,uint256)` — non-zero = liquidatable (the danger signal)
- FTSO v2 `getFeedById(0x015852502f555344...)` — XRP/USD live (raw 1013869 -> $1.013869, 6 decimals)
