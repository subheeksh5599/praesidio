"use client";

import { useState } from "react";
import ConsoleGate from "@/lib/console-gate";
import { useConsole } from "@/lib/console-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
          <h1 className="text-2xl font-semibold tracking-tight">Defense policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register a vault under guardianship. Only the vault&apos;s owner can
            register it (verified on-chain). The policy is committed as part of
            the transaction.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Register a vault</CardTitle>
                <CardDescription>
                  The guardian executes the top-up amount when the vault becomes
                  liquidatable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vault">Agent vault (0x…)</Label>
                  <Input
                    id="vault"
                    value={vaultAddr}
                    onChange={(e) => setVaultAddr(e.target.value)}
                    placeholder="0x55c815260cBE6c45Fe5bFe5FF32E3C7D746f14dC"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ratio">Collateral ratio threshold (BIPS)</Label>
                  <Input
                    id="ratio"
                    value={ratioBIPS}
                    onChange={(e) => setRatioBIPS(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topup">Top-up amount (wei of collateral)</Label>
                  <Input
                    id="topup"
                    value={topUpWei}
                    onChange={(e) => setTopUpWei(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => registerGuard(vaultAddr, ratioBIPS, topUpWei)}
                  disabled={!account}
                >
                  {account ? "Register guard (sign transaction)" : "Connect wallet first"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Guards</CardTitle>
                <CardDescription>
                  {state.guards.length === 0
                    ? "No guards registered yet. Register one to put a vault under guardianship."
                    : "Vaults currently under guardianship."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {state.guards.length === 0 ? null : (
                  <div className="space-y-4">
                    {state.guards.map((g) => (
                      <div key={g.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <a
                            href={`${EXPLORER}/address/${g.vault}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-sm font-semibold text-primary hover:underline"
                          >
                            #{g.id} · {short(g.vault)}
                          </a>
                          {g.active ? (
                            <Badge variant="secondary">active</Badge>
                          ) : (
                            <Badge variant="destructive">paused</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          policy {g.policyRatioBIPS} BIPS · top-up {g.topUpAmountWei} wei
                        </p>
                        {account && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setActive(g.id, !g.active)}
                          >
                            {g.active ? "Pause guard" : "Activate guard"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </ConsoleGate>
  );
}
