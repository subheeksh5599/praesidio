"use client";

import { useState } from "react";
import ConsoleGate from "@/lib/console-gate";
import { useConsole } from "@/lib/console-context";

const EXPLORER = "https://coston2-explorer.flare.network";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function DefendPage() {
  const { account, registerGuard, setActive } = useConsole();
  const [vaultAddr, setVaultAddr] = useState("");
  const [ratioBIPS, setRatioBIPS] = useState("11000");
  const [topUpWei, setTopUpWei] = useState("5000000000000000000");

  return (
    <ConsoleGate>
      {(state) => (
        <>
          <h1 className="text-2xl font-bold">Defense policy</h1>
          <p className="mt-1 text-sm text-muted">
            Register a vault under guardianship. Only the vault&apos;s owner can
            register it (verified on-chain). The policy is committed as part of
            the transaction.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h2 className="text-lg font-bold">Register a vault</h2>
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
                  onClick={() => registerGuard(vaultAddr, ratioBIPS, topUpWei)}
                  disabled={!account}
                  className="w-full rounded-lg bg-pine px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                >
                  {account ? "Register guard (sign transaction)" : "Connect wallet first"}
                </button>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-bold">Guards</h2>
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
                        <a
                          href={`${EXPLORER}/address/${g.vault}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-sm font-semibold text-pine hover:underline"
                        >
                          #{g.id} · {short(g.vault)}
                        </a>
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
                          onClick={() => setActive(g.id, !g.active)}
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
        </>
      )}
    </ConsoleGate>
  );
}
