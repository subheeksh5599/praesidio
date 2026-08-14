// PRAESIDIO guardian service — the always-on loop that turns the pieces into a
// product: read registry guards -> ask the TEE guard to check each vault ->
// relay any enclave-signed action to the GuardianRegistry -> repeat.
//
// Env:
//   COSTON2_RPC_URL   default https://coston2-api.flare.network/ext/C/rpc
//   ASSET_MANAGER     AssetManager diamond (required)
//   GUARDIAN_REGISTRY deployed GuardianRegistry (required)
//   FTSO_V2           FTSO v2 feed contract (required)
//   RELAYER_PK        relayer private key (required, gas payer)
//   TEE_URL           guard extension relay endpoint (default http://127.0.0.1:8080)
//   POLL_INTERVAL_MS  loop cadence (default 20000)
//   HEALTH_PORT       /health port (default 9000)
//   CHAIN_ID          default 114 (Coston2)
import http from "node:http";
import { privateKeyToAccount } from "viem/accounts";
import {
  publicClient,
  walletClient,
  registryAbi,
  GUARDIAN_REGISTRY,
  RELAYER_PK,
} from "./lib.mjs";
import { ACTION } from "./digest.mjs";

const RPC = process.env.COSTON2_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc";
const TEE_URL = (process.env.TEE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 20000);
const HEALTH_PORT = Number(process.env.HEALTH_PORT ?? 9000);
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 114);
const EXPLORER = "https://coston2-explorer.flare.network";

const start = Date.now();
const health = {
  startedAt: new Date().toISOString(),
  lastLoop: null,
  lastError: null,
  guardsWatched: 0,
  actionsPosted: 0,
  checksPerformed: 0,
  teeReachable: false,
  relayer: privateKeyToAccount(RELAYER_PK).address,
};

/* ---------- logging ---------- */
function log(level, msg, fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

/* ---------- resilience ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry a JSON-RPC / HTTP op with exponential backoff + jitter.
async function withRetry(fn, { attempts = 4, base = 500, label = "op" } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1) break;
      const wait = base * 2 ** i + Math.floor(Math.random() * base);
      log("warn", `${label} failed, retry in ${wait}ms`, { error: String(e).slice(0, 160) });
      await sleep(wait);
    }
  }
  throw lastErr;
}

/* ---------- TEE wiring ---------- */
async function teeCheck(vault, guardId) {
  const res = await fetch(`${TEE_URL}/guard/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentVault: vault, guardId }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TEE /guard/check ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/* ---------- the loop ---------- */
async function tick() {
  const pub = publicClient();

  const guardCount = await withRetry(
    () => pub.readContract({ address: GUARDIAN_REGISTRY, abi: registryAbi, functionName: "guardCount" }),
    { label: "guardCount" }
  );
  const signer = await withRetry(
    () => pub.readContract({ address: GUARDIAN_REGISTRY, abi: registryAbi, functionName: "guardianSigner" }),
    { label: "guardianSigner" }
  );

  const n = Number(guardCount);
  health.guardsWatched = n;
  if (n === 0) {
    log("info", "no guards registered yet", { guardCount: n });
    return;
  }

  for (let id = 1; id <= n; id++) {
    const g = await withRetry(
      () => pub.readContract({ address: GUARDIAN_REGISTRY, abi: registryAbi, functionName: "guards", args: [BigInt(id)] }),
      { label: `guards(${id})` }
    ).catch((e) => {
      log("warn", `skip guard ${id}`, { error: String(e).slice(0, 120) });
      return null;
    });
    if (!g) continue;

    const [vault, , , , lastActionNonce, , active] = g;
    if (!active) continue;

    let result;
    try {
      result = await teeCheck(vault, id);
      health.teeReachable = true;
      health.checksPerformed++;
    } catch (e) {
      health.teeReachable = false;
      log("error", `tee check failed for guard ${id}`, { vault, error: String(e).slice(0, 200) });
      continue;
    }

    const { decision, health: vh, signed } = result;
    log("info", `guard ${id} check`, {
      vault,
      decision,
      liquidatable: vh?.liquidatable,
      xrpUsd: vh?.xrpUsd,
      signed: Boolean(signed),
    });

    if (!signed || decision !== "TOP_UP_REQUIRED") continue;

    // Nonce + signer safety before spending gas.
    const fresh = await withRetry(
      () => pub.readContract({ address: GUARDIAN_REGISTRY, abi: registryAbi, functionName: "guards", args: [BigInt(id)] }),
      { label: `guards(${id}) recheck` }
    );
    const freshNonce = fresh[4];
    if (BigInt(signed.nonce) !== BigInt(freshNonce) + 1n) {
      log("warn", `stale nonce for guard ${id}`, { signed: signed.nonce, onChain: freshNonce.toString() });
      continue;
    }
    if (signed.signer.toLowerCase() !== signer.toLowerCase()) {
      log("error", `signer mismatch for guard ${id}`, { signed: signed.signer, onChain: signer });
      continue;
    }

    try {
      const wallet = walletClient();
      const hash = await wallet.writeContract({
        address: GUARDIAN_REGISTRY,
        abi: registryAbi,
        functionName: "postAction",
        args: [BigInt(id), Number(signed.actionType), BigInt(signed.amount), BigInt(signed.nonce), signed.signature],
      });
      const receipt = await withRetry(
        () => pub.waitForTransactionReceipt({ hash, timeout: 60000 }),
        { label: "receipt", base: 1000 }
      );
      health.actionsPosted++;
      log("info", `action posted for guard ${id}`, {
        tx: hash,
        status: receipt.status,
        explorer: `${EXPLORER}/tx/${hash}`,
        type: ACTION[Number(signed.actionType)] ?? signed.actionType,
      });
    } catch (e) {
      log("error", `postAction failed for guard ${id}`, { error: String(e).slice(0, 240) });
    }
  }
}

async function loop() {
  for (;;) {
    health.lastLoop = new Date().toISOString();
    try {
      await tick();
      health.lastError = null;
    } catch (e) {
      health.lastError = String(e).slice(0, 240);
      log("error", "tick failed", { error: health.lastError });
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

/* ---------- health endpoint ---------- */
function healthServer() {
  const srv = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      // Healthy = the loop has run and the registry read succeeded. teeReachable
      // is informational (only set once a guard check actually runs).
      const ok = health.lastLoop !== null && health.lastError === null;
      res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: ok ? "ok" : "degraded", uptimeSec: Math.round((Date.now() - start) / 1000), ...health }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  srv.listen(HEALTH_PORT, () => log("info", `health server on :${HEALTH_PORT}`));
  return srv;
}

/* ---------- start ---------- */
if (!GUARDIAN_REGISTRY || !RELAYER_PK) {
  log("error", "GUARDIAN_REGISTRY and RELAYER_PK env required");
  process.exit(1);
}

log("info", "PRAESIDIO guardian service starting", {
  registry: GUARDIAN_REGISTRY,
  relayer: privateKeyToAccount(RELAYER_PK).address,
  rpc: RPC,
  tee: TEE_URL,
  pollIntervalMs: POLL_INTERVAL_MS,
});

const h = healthServer();
const loopPromise = loop();

let shuttingDown = false;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("info", "shutdown requested");
    h.close();
    process.exit(0);
  });
}

loopPromise.catch((e) => {
  log("error", "fatal", { error: String(e) });
  process.exit(1);
});
