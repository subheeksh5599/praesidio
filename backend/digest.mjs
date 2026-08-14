// Digest + signature helpers shared by the guardian service and tests.
// The digest must match the GuardianRegistry's postAction verification exactly:
//
//   digest = keccak256("\x19Ethereum Signed Message:\n32" || keccak256(abi.encode(chainId, guardId, actionType, amount, nonce)))
//
// Solidity types: (uint256 chainId, uint256 guardId, uint8 actionType,
// uint256 amount, uint64 nonce) — abi.encode pads every value to a 32-byte
// word, so the five values are five words.
import { concat, encodeAbiParameters, keccak256 } from "viem";

// "\x19Ethereum Signed Message:\n32" — the exact EIP-191 prefix the
// GuardianRegistry uses (inner is always 32 bytes). Do NOT use viem's
// hashMessage here: it computes a different prefix than the contract.
const PREFIX_HEX =
  "0x" + Buffer.from("\x19Ethereum Signed Message:\n32", "utf8").toString("hex");

export const ACTION = {
  HEARTBEAT: 0,
  VAULT_TOP_UP: 1,
  REDEMPTION_HANDLED: 2,
};

/**
 * The exact 32-byte digest the registry verifies for a posted action.
 * @param {number|bigint} chainId
 * @param {number|bigint} guardId
 * @param {number} actionType
 * @param {bigint|string} amount
 * @param {number|bigint} nonce
 */
export function guardDigest(chainId, guardId, actionType, amount, nonce) {
  const inner = keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint8" },
        { type: "uint256" },
        { type: "uint64" },
      ],
      [BigInt(chainId), BigInt(guardId), actionType, BigInt(amount), BigInt(nonce)]
    )
  );
  // The digest = keccak256(prefix || inner), prefix = "\x19Ethereum Signed
  // Message:\n32" (inner is a keccak256, always 32 bytes).
  return keccak256(concat([PREFIX_HEX, inner]));
}

/**
 * Build the postAction call args, reading the next nonce from the on-chain
 * guard (lastActionNonce + 1). Returns null when the nonce is already used.
 */
export function nextNonce(lastActionNonce) {
  return BigInt(lastActionNonce) + 1n;
}
