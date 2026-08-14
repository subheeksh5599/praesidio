// Guardian digest + nonce unit tests (node:test). The digest constant below is
// cross-validated against the Go guard's registryDigest (tee/.../extension_test.go)
// for the SAME inputs — agreement proves the signer (Go) and relayer (Node)
// compute the identical digest the GuardianRegistry verifies.
import test from "node:test";
import assert from "node:assert/strict";
import { guardDigest, nextNonce, ACTION } from "./digest.mjs";

test("guardDigest matches the Solidity encoding (cross-language constant)", () => {
  const d = guardDigest(114, 7, ACTION.VAULT_TOP_UP, 5000000000000000000n, 3);
  assert.equal(d, "0xbbbc9727d54eacb44ab94712676223d76bc9b62c448c478a194afdb78dea56b2");
});

test("guardDigest is sensitive to every field", () => {
  const base = guardDigest(114, 7, 1, 5000000000000000000n, 3);
  assert.notEqual(guardDigest(114, 7, 1, 5000000000000000000n, 4), base); // nonce
  assert.notEqual(guardDigest(114, 7, 1, 5000000000000000001n, 3), base); // amount
  assert.notEqual(guardDigest(114, 7, 2, 5000000000000000000n, 3), base); // type
  assert.notEqual(guardDigest(114, 8, 1, 5000000000000000000n, 3), base); // guardId
  assert.notEqual(guardDigest(14, 7, 1, 5000000000000000000n, 3), base); // chainId
});

test("nextNonce is lastActionNonce + 1", () => {
  assert.equal(nextNonce(0n), 1n);
  assert.equal(nextNonce(41n), 42n);
});

test("action type constants match the registry", () => {
  assert.equal(ACTION.HEARTBEAT, 0);
  assert.equal(ACTION.VAULT_TOP_UP, 1);
  assert.equal(ACTION.REDEMPTION_HANDLED, 2);
});
