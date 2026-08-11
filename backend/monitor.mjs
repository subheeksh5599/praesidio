// Monitor: reads a guard's vault health + the audit ledger live from Coston2.
// Usage: VAULT=<agent-vault> GUARD_ID=<id> node backend/monitor.mjs
import { readFileSync } from "node:fs";
import { vaultHealth, publicClient, registryAbi, GUARDIAN_REGISTRY } from "./lib.mjs";

const vault = process.env.VAULT;
const guardId = process.env.GUARD_ID ? BigInt(process.env.GUARD_ID) : null;

if (!vault) {
  console.error("VAULT env required (agent vault address)");
  process.exit(1);
}
if (guardId !== null && !GUARDIAN_REGISTRY) {
  console.error("GUARDIAN_REGISTRY env required when GUARD_ID is set");
  process.exit(1);
}

const health = await vaultHealth(vault);
console.log("=== PRAESIDIO monitor — live Coston2 ===");
console.log(`vault:               ${health.vault}`);
console.log(`vault collateral:    ${health.vaultCollateralWei} wei`);
console.log(`liq factor vault:    ${health.liqFactorVaultBIPS} BIPS`);
console.log(`liq factor pool:     ${health.liqFactorPoolBIPS} BIPS`);
console.log(`max liquidation:     ${health.maxLiquidationAmountUBA} UBA`);
console.log(`XRP/USD:             ${health.xrpUsd}`);
console.log(`liquidatable:        ${health.liquidatable}`);

if (guardId !== null) {
  const pub = publicClient();
  const guard = await pub.readContract({
    address: GUARDIAN_REGISTRY,
    abi: registryAbi,
    functionName: "guards",
    args: [guardId],
  });
  console.log("\n=== guard ===");
  console.log(`agentVault:          ${guard[0]}`);
  console.log(`owner:               ${guard[1]}`);
  console.log(`policy ratio BIPS:   ${guard[2].toString()}`);
  console.log(`top-up amount:       ${guard[3].toString()} wei`);
  console.log(`active:              ${guard[6]}`);
  const actions = await pub.readContract({
    address: GUARDIAN_REGISTRY,
    abi: registryAbi,
    functionName: "getActions",
    args: [guardId],
  });
  console.log(`\naudit ledger (${actions.length} actions):`);
  for (const a of actions) {
    console.log(`  type=${a[0]} amount=${a[1].toString()} nonce=${a[2].toString()} ts=${a[3].toString()}`);
  }
}
