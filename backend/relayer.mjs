// Relayer: posts a TEE-signed action to the GuardianRegistry on-chain.
// Usage: GUARD_ID=<id> ACTION_TYPE=<0|1|2> AMOUNT=<wei> NONCE=<n> SIG=<0x65bytes> node backend/relayer.mjs
// (In the live loop the SIG comes from the TEE extension's signed action.)
import { walletClient, publicClient, registryAbi, GUARDIAN_REGISTRY, RELAYER_PK } from "./lib.mjs";

const guardId = BigInt(process.env.GUARD_ID ?? "");
const actionType = Number(process.env.ACTION_TYPE ?? "");
const amount = BigInt(process.env.AMOUNT ?? "0");
const nonce = BigInt(process.env.NONCE ?? "1");
const sig = process.env.SIG ?? "";

if (!GUARDIAN_REGISTRY || !RELAYER_PK) {
  console.error("GUARDIAN_REGISTRY and RELAYER_PK env required");
  process.exit(1);
}
if (!sig.startsWith("0x") || sig.length !== 132) {
  console.error("SIG must be 65-byte hex (0x + 130 chars)");
  process.exit(1);
}

const wallet = walletClient();
const pub = publicClient();

console.log(`Posting action guard=${guardId} type=${actionType} amount=${amount} nonce=${nonce}`);
const hash = await wallet.writeContract({
  address: GUARDIAN_REGISTRY,
  abi: registryAbi,
  functionName: "postAction",
  args: [guardId, actionType, amount, nonce, sig],
});
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`postAction tx: https://coston2-explorer.flare.network/tx/${hash}`);
console.log(`status: ${receipt.status}`);
