"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConsoleProvider, useConsole } from "@/lib/console-context";

const NAV = [
  { href: "/watch", label: "Watch" },
  { href: "/defend", label: "Defend" },
  { href: "/prove", label: "Prove" },
] as const;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function Shell({ children }: { children: React.ReactNode }) {
  const { account, connect, walletErr, notice } = useConsole();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-sage/40 px-4 py-6">
        <span className="px-2 text-lg font-bold tracking-tight">PRAESIDIO</span>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-pine text-white" : "text-muted hover:bg-sage hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 px-2 text-xs text-muted">
          <p>Chain: Coston2</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-line px-6 py-3">
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
          <p className="mx-6 mt-4 rounded-lg bg-rust/10 px-4 py-2 text-sm font-semibold text-rust">
            {walletErr}
          </p>
        )}
        {notice && (
          <p className="mx-6 mt-4 rounded-lg bg-pine-soft px-4 py-2 text-sm font-semibold text-pine break-all">
            {notice}
          </p>
        )}

        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleProvider>
      <Shell>{children}</Shell>
    </ConsoleProvider>
  );
}
