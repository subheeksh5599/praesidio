"use client";

import ConsoleGate from "@/lib/console-gate";

const EXPLORER = "https://coston2-explorer.flare.network";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function WatchPage() {
  return (
    <ConsoleGate>
      {(state) => (
        <>
          <h1 className="text-2xl font-bold">Live vault health</h1>
          <p className="mt-1 text-sm text-muted">
            Real agent vaults on Coston2. A vault is liquidatable when the
            FAssets manager reports non-zero liquidation factors. XRP/USD is the
            live FTSO v2 feed.
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
        </>
      )}
    </ConsoleGate>
  );
}
