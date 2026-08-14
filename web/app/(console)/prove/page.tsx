"use client";

import ConsoleGate from "@/lib/console-gate";

const EXPLORER = "https://coston2-explorer.flare.network";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function ProvePage() {
  return (
    <ConsoleGate>
      {(state) => (
        <>
          <h1 className="text-2xl font-bold">Attestable action ledger</h1>
          <p className="mt-1 text-sm text-muted">
            Every action the guardian executed, signed by the enclave and
            recorded on-chain in the GuardianRegistry. Anyone can verify the
            guardian behaved.
          </p>
          {state.guards.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              No guards registered yet — nothing to prove.
            </p>
          ) : (
            state.guards.map((g) => (
              <div key={g.id} className="card mt-5 p-5">
                <a
                  href={`${EXPLORER}/address/${g.vault}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm font-semibold text-pine hover:underline"
                >
                  Guard #{g.id} · {short(g.vault)}
                </a>
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
        </>
      )}
    </ConsoleGate>
  );
}
