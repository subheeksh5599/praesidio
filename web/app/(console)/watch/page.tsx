"use client";

import ConsoleGate from "@/lib/console-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const EXPLORER = "https://coston2-explorer.flare.network";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function WatchPage() {
  return (
    <ConsoleGate>
      {(state) => (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Live vault health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real agent vaults on Coston2. A vault is liquidatable when the FAssets
            manager reports non-zero liquidation factors. XRP/USD is the live FTSO
            v2 feed.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {state.vaults.map((v) => (
              <Card key={v.vault}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <a
                      href={`${EXPLORER}/address/${v.vault}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {short(v.vault)}
                    </a>
                    {v.liquidatable ? (
                      <Badge variant="destructive">liquidatable</Badge>
                    ) : v.error ? (
                      <Badge variant="outline">read failed</Badge>
                    ) : (
                      <Badge variant="secondary">healthy</Badge>
                    )}
                  </div>
                  {!v.error && (
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Vault collateral (wei)</dt>
                        <dd className="font-mono font-semibold">{v.collateralWei}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Liq. factor (vault)</dt>
                        <dd className="font-mono font-semibold">{v.liqFactorVaultBIPS} BIPS</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Liq. factor (pool)</dt>
                        <dd className="font-mono font-semibold">{v.liqFactorPoolBIPS} BIPS</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Max liquidation</dt>
                        <dd className="font-mono font-semibold">{v.maxLiquidationUBA} UBA</dd>
                      </div>
                    </dl>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            XRP/USD: ${state.price?.toFixed(4) ?? "n/a"} · updated every 20s
          </p>
        </>
      )}
    </ConsoleGate>
  );
}
