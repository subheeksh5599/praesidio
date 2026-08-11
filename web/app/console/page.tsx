"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, defineChain, parseAbi } from "viem";

type State = {
  configured: boolean;
  error?: string;
  chain: {
    chainId: number;
    rpcUrl: string;
    assetManager: string;
    guardianRegistry: string;
    ftsoV2: string;
  } | null;
  vaults: {
    vault: string;
    collateralWei?: string;
    liqFactorVaultBIPS?: string;
    liqFactorPoolBIPS?: string;
    maxLiquidationUBA?: string;
    liquidatable?: boolean;
    error?: string;
  }[];
  guards: {
    id: number;
    vault: string;
    owner: string;
    policyRatioBIPS: string;
    topUpAmountWei: string;
    active: boolean;
    actions: { type: string; amount: string; nonce: string; timestamp: string }[];
  }[];
  price: number | null;
};

const registryAbi = parseAbi([
  "function registerAgentVault(address, uint64, uint256) returns (uint256)",
  "function setPolicy(uint256, uint64, uint256)",
  "function setGuardActive(uint256, bool)",
]);

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const EXPLORER = "https://coston2-explorer.flare.network";
const TABS = ["Watch", "Defend", "Prove"] as const;

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export default function ConsolePage() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Watch");
  const [account, setAccount] = useState<string | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // DEFEND form
  const [vaultAddr, setVaultAddr] = useState("");
  const [ratioBIPS, setRatioBIPS] = useState("11000");
  const [topUpWei, setTopUpWei] = useState("5000000000000000000");

  const refresh = useCallback(() => {
    fetch("/api/state", { cache: "no-store" })
      .then((r) => r.json())
      .then(setState)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  const connect = async () => {
    const eth = window.ethereum;
    if (!eth) {
      setWalletErr("No injected wallet found. Install MetaMask and enable it.");
      return;
    }
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const want = `0x${(state?.chain?.chainId ?? 114).toString(16)}`;
      const current = (await eth.request({ method: "eth_chainId" })) as string;
      if (current.toLowerCase() !== want) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: want }] });
        } catch (e) {
          if ((e as { code?: number })?.code === 4902) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: want,
                  chainName: "Flare Testnet Coston2",
                  rpcUrls: [state?.chain?.rpcUrl ?? "https://coston2-api.flare.network/ext/C/rpc"],
                  nativeCurrency: { name: "C2FLR", symbol: "C2FLR", decimals: 18 },
                },
              ],
            });
          } else throw e;
        }
      }
      setAccount(accounts[0] ?? null);
      setWalletErr(null);
    } catch (e) {
      setWalletErr(e instanceof Error ? e.message : String(e));
    }
  };

  const chainDef = useMemo(
    () =>
      defineChain({
        id: state?.chain?.chainId ?? 114,
        name: "Coston2",
        nativeCurrency: { name: "C2FLR", symbol: "C2FLR", decimals: 18 },
        rpcUrls: { default: { http: [state?.chain?.rpcUrl ?? "https://coston2-api.flare.network/ext/C/rpc"] } },
      }),
    [state]
  );

  const registerGuard = async () => {
    if (!account || !state?.chain) return;
    if (!/^0x[0-9a-fA-F]{40}$/.test(vaultAddr)) {
      setNotice("Enter a valid vault address (0x…).");
      return;
    }
    try {
      const wallet = createWalletClient({ transport: custom(window.ethereum!) });
      const tx = await wallet.writeContract({
        account: account as `0x${string}`,
        chain: chainDef,
        address: state.chain.guardianRegistry as `0x${string}`,
        abi: registryAbi,
        functionName: "registerAgentVault",
        args: [
          vaultAddr as `0x${string}`,
          BigInt(ratioBIPS),
          BigInt(topUpWei),
        ],
      });
      setNotice(`Register tx sent: ${EXPLORER}/tx/${tx}`);
      setTimeout(refresh, 8000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  };

  const setActive = async (id: number, active: boolean) => {
    if (!account || !state?.chain) return;
    try {
      const wallet = createWalletClient({ transport: custom(window.ethereum!) });
      const tx = await wallet.writeContract({
        account: account as `0x${string}`,
        chain: chainDef,
        address: state.chain.guardianRegistry as `0x${string}`,
        abi: registryAbi,
        functionName: "setGuardActive",
        args: [BigInt(id), active],
      });
      setNotice(`Guard ${id} ${active ? "activated" : "deactivated"}: ${EXPLORER}/tx/${tx}`);
      setTimeout(refresh, 8000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  };

  if (error || state?.error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold">Could not read the chain</h1>
        <p className="mt-2 text-muted break-all">{error ?? state?.error}</p>
      </div>
    );
  }
  if (!state?.configured) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold">Not configured</h1>
        <p className="mt-2 text-muted">
          Set ASSET_MANAGER, GUARDIAN_REGISTRY and FTSO_V2 in the deployment env.
          Nothing is displayed until then.
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold tracking-tight">VIGILUM</span>
          <nav className="flex gap-1 rounded-lg bg-sage p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                  tab === t ? "bg-pine text-white" : "text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
        {account ? (
          <span className="chip bg-sage">
            <span className="dot-ok" />
            {short(account)}
          </span>
        ) : (
          <button
            onClick={connect}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Connect wallet
          </button>
        )}
      </header>

      {walletErr && (
        <p className="mt-4 rounded-lg bg-rust/10 px-4 py-2 text-sm font-semibold text-rust">
          {walletErr}
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-lg bg-pine-soft px-4 py-2 text-sm font-semibold text-pine break-all">
          {notice}
        </p>
      )}

      <div className="mt-8">
        {tab === "Watch" && <WatchTab state={state} />}
        {tab === "Defend" && (
          <DefendTab
            state={state}
            account={account}
            vaultAddr={vaultAddr}
            setVaultAddr={setVaultAddr}
            ratioBIPS={ratioBIPS}
            setRatioBIPS={setRatioBIPS}
            topUpWei={topUpWei}
            setTopUpWei={setTopUpWei}
            onRegister={registerGuard}
            onSetActive={setActive}
          />
        )}
        {tab === "Prove" && <ProveTab state={state} />}
      </div>
    </main>
  );
}

/* ---------- tabs ---------- */

function WatchTab({ state }: { state: State }) {
  return (
    <div>
      <h2 className="text-xl font-bold">Live vault health</h2>
      <p className="mt-1 text-sm text-muted">
        Real agent vaults on Coston2. A vault is liquidatable when the FAssets
        manager reports non-zero liquidation factors. XRP/USD is the live FTSO
        v2 feed.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {state.vaults.map((v) => (
          <div key={v.vault} className="card p-5">
            <div className="flex items-center justify-between">
              <a
                href={`${EXPLORER}/address/${v.vault}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm font-semibold text-pine hover:underline"
              >
                {short(v.vault)}
              </a>
              {v.liquidatable ? (
                <span className="chip bg-rust/10 text-rust">
                  <span className="dot-danger" /> liquidatable
                </span>
              ) : v.error ? (
                <span className="chip bg-rust/10 text-rust">read failed</span>
              ) : (
                <span className="chip bg-pine-soft text-pine">
                  <span className="dot-ok" /> healthy
                </span>
              )}
            </div>
            {!v.error && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Vault collateral</dt>
                  <dd className="font-mono font-semibold">
                    {(Number(v.collateralWei) / 1e18).toFixed(4)} C2FLR
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Liq. factor (vault)</dt>
                  <dd className="font-mono font-semibold">{v.liqFactorVaultBIPS} BIPS</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Liq. factor (pool)</dt>
                  <dd className="font-mono font-semibold">{v.liqFactorPoolBIPS} BIPS</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Max liquidation</dt>
                  <dd className="font-mono font-semibold">{v.maxLiquidationUBA} UBA</dd>
                </div>
              </dl>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        XRP/USD: ${state.price?.toFixed(4) ?? "—"} · updated every 20s
      </p>
    </div>
  );
}

function DefendTab({
  state,
  account,
  vaultAddr,
  setVaultAddr,
  ratioBIPS,
  setRatioBIPS,
  topUpWei,
  setTopUpWei,
  onRegister,
  onSetActive,
}: {
  state: State;
  account: string | null;
  vaultAddr: string;
  setVaultAddr: (v: string) => void;
  ratioBIPS: string;
  setRatioBIPS: (v: string) => void;
  topUpWei: string;
  setTopUpWei: (v: string) => void;
  onRegister: () => void;
  onSetActive: (id: number, active: boolean) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="text-xl font-bold">Register a vault</h2>
        <p className="mt-1 text-sm text-muted">
          Only the vault's owner can register it (verified on-chain). The
          policy is committed as part of the transaction.
        </p>
        <div className="mt-5 space-y-4">
          <label className="block text-xs font-bold text-muted">
            AGENT VAULT (0x…)
            <input
              value={vaultAddr}
              onChange={(e) => setVaultAddr(e.target.value)}
              placeholder="0x55c815260cBE6c45Fe5bFe5FF32E3C7D746f14dC"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-sm outline-none focus:border-pine"
            />
          </label>
          <label className="block text-xs font-bold text-muted">
            POLICY — COLLATERAL RATIO THRESHOLD (BIPS)
            <input
              value={ratioBIPS}
              onChange={(e) => setRatioBIPS(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pine"
            />
          </label>
          <label className="block text-xs font-bold text-muted">
            POLICY — TOP-UP AMOUNT (WEI OF COLLATERAL)
            <input
              value={topUpWei}
              onChange={(e) => setTopUpWei(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pine"
            />
          </label>
          <button
            onClick={onRegister}
            disabled={!account}
            className="w-full rounded-lg bg-pine px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {account ? "Register guard (sign transaction)" : "Connect wallet first"}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold">Guards</h2>
        {state.guards.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No guards registered yet. Register one to put a vault under
            guardianship.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {state.guards.map((g) => (
              <div key={g.id} className="rounded-lg border border-line p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">
                    #{g.id} · {short(g.vault)}
                  </span>
                  {g.active ? (
                    <span className="chip bg-pine-soft text-pine">
                      <span className="dot-ok" /> active
                    </span>
                  ) : (
                    <span className="chip bg-rust/10 text-rust">
                      <span className="dot-danger" /> paused
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  policy {g.policyRatioBIPS} BIPS · top-up {g.topUpAmountWei} wei
                </p>
                {account && (
                  <button
                    onClick={() => onSetActive(g.id, !g.active)}
                    className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-sage"
                  >
                    {g.active ? "Pause guard" : "Activate guard"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProveTab({ state }: { state: State }) {
  return (
    <div>
      <h2 className="text-xl font-bold">Attestable action ledger</h2>
      <p className="mt-1 text-sm text-muted">
        Every action the guardian executed, signed by the enclave and recorded
        on-chain in the GuardianRegistry.
      </p>
      {state.guards.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No actions recorded yet.</p>
      ) : (
        state.guards.map((g) => (
          <div key={g.id} className="card mt-5 p-5">
            <p className="font-mono text-sm font-semibold">
              Guard #{g.id} · {short(g.vault)}
            </p>
            {g.actions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No actions yet.</p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="pb-2">TYPE</th>
                    <th className="pb-2">AMOUNT (WEI)</th>
                    <th className="pb-2">NONCE</th>
                    <th className="pb-2">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {g.actions.map((a) => (
                    <tr key={a.nonce} className="border-t border-line">
                      <td className="py-2">{a.type}</td>
                      <td className="py-2">{a.amount}</td>
                      <td className="py-2">{a.nonce}</td>
                      <td className="py-2">
                        {new Date(Number(a.timestamp) * 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </div>
  );
}
