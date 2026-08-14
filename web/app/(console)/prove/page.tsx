"use client";

import ConsoleGate from "@/lib/console-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EXPLORER = "https://coston2-explorer.flare.network";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function ProvePage() {
  return (
    <ConsoleGate>
      {(state) => (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Attestable action ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every action the guardian executed, signed by the enclave and recorded
            on-chain in the GuardianRegistry. Anyone can verify the guardian behaved.
          </p>
          {state.guards.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No guards registered yet — nothing to prove.
            </p>
          ) : (
            state.guards.map((g) => (
              <Card key={g.id} className="mt-5">
                <CardHeader>
                  <CardTitle className="font-mono text-sm">
                    <a
                      href={`${EXPLORER}/address/${g.vault}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Guard #{g.id} · {short(g.vault)}
                    </a>
                  </CardTitle>
                  <CardDescription>
                    {g.actions.length === 0
                      ? "No actions yet."
                      : `${g.actions.length} signed actions recorded on-chain.`}
                  </CardDescription>
                </CardHeader>
                {g.actions.length > 0 && (
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount (wei)</TableHead>
                          <TableHead>Nonce</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="font-mono">
                        {g.actions.map((a) => (
                          <TableRow key={a.nonce}>
                            <TableCell>{a.type}</TableCell>
                            <TableCell>{a.amount}</TableCell>
                            <TableCell>{a.nonce}</TableCell>
                            <TableCell>
                              {new Date(Number(a.timestamp) * 1000).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </>
      )}
    </ConsoleGate>
  );
}
