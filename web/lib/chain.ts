// VIGILUM web data layer — live Coston2 reads. Deployment values from env;
// only public protocol constants defaulted.
import { createPublicClient, http, parseAbi } from "viem";

const RPC =
  process.env.COSTON2_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc";
const ASSET_MANAGER = process.env.ASSET_MANAGER ?? "";
const GUARDIAN_REGISTRY = process.env.GUARDIAN_REGISTRY ?? "";
const FTSO_V2 = process.env.FTSO_V2 ?? "";
const XRP_USD_FEED = "0x015852502f55534400000000000000000000000000";

const assetManagerAbi = parseAbi([
  "function getAgentFullVaultCollateral(address) view returns (uint256)",
  "function getAgentLiquidationFactorsAndMaxAmount(address) view returns (uint256, uint256, uint256)",
  "function getAvailableAgentsList(uint256,uint256) view returns (address[])",
]);
const ftsoAbi = parseAbi([
  "function getFeedById(bytes21) view returns (uint256 value, int8 decimals, uint64 timestamp)",
]);
const registryAbi = parseAbi([
  "function guards(uint256) view returns (address agentVault, address owner, uint64 vaultCollateralRatioBIPS, uint256 topUpAmountWei, uint64 lastActionNonce, uint64 createdAt, bool active)",
  "function getActions(uint256) view returns ((uint8 actionType, uint256 amount, uint64 nonce, uint64 timestamp)[])",
  "function guardCount() view returns (uint256)",
  "function guardianSigner() view returns (address)",
]);

const chain = {
  id: 114,
  name: "Coston2",
  nativeCurrency: { name: "C2FLR", symbol: "C2FLR", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

export const ACTION_NAMES: Record<number, string> = {
  0: "heartbeat",
  1: "vault top-up",
  2: "redemption handled",
};

export async function getState() {
  if (!ASSET_MANAGER || !GUARDIAN_REGISTRY || !FTSO_V2) {
    return { configured: false, chain: null, vaults: [], guards: [], price: null };
  }
  const pub = createPublicClient({ chain, transport: http(RPC) });
  try {
    const [vaults, guardCount, feed] = await Promise.all([
      pub
        .readContract({
          address: ASSET_MANAGER as `0x${string}`,
          abi: assetManagerAbi,
          functionName: "getAvailableAgentsList",
          args: [BigInt(0), BigInt(10)],
        })
        .catch(() => [] as `0x${string}`[]),
      pub
        .readContract({
          address: GUARDIAN_REGISTRY as `0x${string}`,
          abi: registryAbi,
          functionName: "guardCount",
        })
        .catch(() => BigInt(0)),
      pub
        .readContract({
          address: FTSO_V2 as `0x${string}`,
          abi: ftsoAbi,
          functionName: "getFeedById",
          args: [XRP_USD_FEED as `0x${string}`],
        })
        .catch(() => null),
    ]);

    // Per-vault health (parallel, bounded).
    const health = await Promise.all(
      (vaults as `0x${string}`[]).slice(0, 6).map(async (v) => {
        try {
          const [factors, collateral] = await Promise.all([
            pub.readContract({
              address: ASSET_MANAGER as `0x${string}`,
              abi: assetManagerAbi,
              functionName: "getAgentLiquidationFactorsAndMaxAmount",
              args: [v],
            }),
            pub.readContract({
              address: ASSET_MANAGER as `0x${string}`,
              abi: assetManagerAbi,
              functionName: "getAgentFullVaultCollateral",
              args: [v],
            }),
          ]);
          const [fv, fp, max] = factors;
          return {
            vault: v,
            collateralWei: collateral.toString(),
            liqFactorVaultBIPS: fv.toString(),
            liqFactorPoolBIPS: fp.toString(),
            maxLiquidationUBA: max.toString(),
            liquidatable: fv > BigInt(0) || fp > BigInt(0),
          };
        } catch {
          return { vault: v, error: "read failed" };
        }
      })
    );

    // Guards + their audit ledgers (bounded).
    const guards = [];
    const n = Math.min(Number(guardCount), 10);
    for (let i = 1; i <= n; i++) {
      try {
        const g = await pub.readContract({
          address: GUARDIAN_REGISTRY as `0x${string}`,
          abi: registryAbi,
          functionName: "guards",
          args: [BigInt(i)],
        });
        const actions = await pub.readContract({
          address: GUARDIAN_REGISTRY as `0x${string}`,
          abi: registryAbi,
          functionName: "getActions",
          args: [BigInt(i)],
        });
        guards.push({
          id: i,
          vault: g[0],
          owner: g[1],
          policyRatioBIPS: g[2].toString(),
          topUpAmountWei: g[3].toString(),
          active: g[6],
          actions: actions.map((a: { actionType: number; amount: bigint; nonce: bigint; timestamp: bigint }) => ({
            type: ACTION_NAMES[Number(a.actionType)] ?? String(a.actionType),
            amount: a.amount.toString(),
            nonce: a.nonce.toString(),
            timestamp: a.timestamp.toString(),
          })),
        });
      } catch {
        /* skip unreadable guard */
      }
    }

    const price = feed
      ? Number(feed[0]) / 10 ** Number(feed[1])
      : null;

    return {
      configured: true,
      chain: { chainId: 114, rpcUrl: RPC, assetManager: ASSET_MANAGER, guardianRegistry: GUARDIAN_REGISTRY, ftsoV2: FTSO_V2 },
      vaults: health,
      guards,
      price,
    };
  } catch (e) {
    return {
      configured: true,
      error: e instanceof Error ? e.message : String(e),
      chain: null,
      vaults: [],
      guards: [],
      price: null,
    };
  }
}
