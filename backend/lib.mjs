// Shared viem client + ABIs for the PRAESIDIO backend. All deployment values
// come from env; only public protocol constants (RPC, feed id) have defaults.
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const RPC =
  process.env.COSTON2_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc";
// Deployment values — REQUIRED env (no fallbacks).
export const ASSET_MANAGER = process.env.ASSET_MANAGER ?? "";
export const GUARDIAN_REGISTRY = process.env.GUARDIAN_REGISTRY ?? "";
export const FTSO_V2 = process.env.FTSO_V2 ?? "";
export const RELAYER_PK = process.env.RELAYER_PK ?? "";

// FTSO v2 XRP/USD feed id (0x01 + "XRP/USD" right-padded to 21 bytes).
export const XRP_USD_FEED = "0x015852502f55534400000000000000000000000000";

export const assetManagerAbi = parseAbi([
  "function getAgentVaultOwner(address) view returns (address)",
  "function getAgentFullVaultCollateral(address) view returns (uint256)",
  "function getAgentLiquidationFactorsAndMaxAmount(address) view returns (uint256, uint256, uint256)",
  "function getAgentVaultCollateralToken(address) view returns (address)",
  "function getAvailableAgentsList(uint256,uint256) view returns (address[])",
]);
export const ftsoAbi = parseAbi([
  "function getFeedById(bytes21) view returns (uint256 value, int8 decimals, uint64 timestamp)",
]);
export const registryAbi = parseAbi([
  "function guards(uint256) view returns (address agentVault, address owner, uint64 vaultCollateralRatioBIPS, uint256 topUpAmountWei, uint64 lastActionNonce, uint64 createdAt, bool active)",
  "function getActions(uint256) view returns ((uint8 actionType, uint256 amount, uint64 nonce, uint64 timestamp)[])",
  "function actionsCount(uint256) view returns (uint256)",
  "function postAction(uint256, uint8, uint256, uint64, bytes)",
  "function guardCount() view returns (uint256)",
  "function guardianSigner() view returns (address)",
  "function paused() view returns (bool)",
]);

export const chain = {
  id: 114,
  name: "Coston2",
  nativeCurrency: { name: "C2FLR", symbol: "C2FLR", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

export function publicClient() {
  return createPublicClient({ chain, transport: http(RPC) });
}

export function walletClient() {
  return createWalletClient({
    account: privateKeyToAccount(RELAYER_PK),
    chain,
    transport: http(RPC),
  });
}

/** Live vault health: liquidation factors, collateral, XRP/USD. */
export async function vaultHealth(vault) {
  const pub = publicClient();
  const [factors, collateral, feed] = await Promise.all([
    pub.readContract({
      address: ASSET_MANAGER,
      abi: assetManagerAbi,
      functionName: "getAgentLiquidationFactorsAndMaxAmount",
      args: [vault],
    }),
    pub.readContract({
      address: ASSET_MANAGER,
      abi: assetManagerAbi,
      functionName: "getAgentFullVaultCollateral",
      args: [vault],
    }),
    pub.readContract({
      address: FTSO_V2,
      abi: ftsoAbi,
      functionName: "getFeedById",
      args: [XRP_USD_FEED],
    }),
  ]);
  const [liqVaultBIPS, liqPoolBIPS, maxLiqUBA] = factors;
  const [value, decimals] = feed;
  return {
    vault,
    vaultCollateralWei: collateral.toString(),
    liqFactorVaultBIPS: liqVaultBIPS.toString(),
    liqFactorPoolBIPS: liqPoolBIPS.toString(),
    maxLiquidationAmountUBA: maxLiqUBA.toString(),
    xrpUsd: (Number(value) / 10 ** Number(decimals)).toFixed(6),
    liquidatable: liqVaultBIPS > 0n || liqPoolBIPS > 0n,
  };
}
