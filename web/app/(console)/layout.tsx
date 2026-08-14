"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConsoleProvider, useConsole } from "@/lib/console-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar px-3 py-5">
        <span className="px-3 text-lg font-semibold tracking-tight">PRAESIDIO</span>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-3 text-xs text-muted-foreground">
          <p>Chain: Coston2</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b px-6 py-3">
          {account ? (
            <Badge variant="secondary" className="gap-1.5 font-mono">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {short(account)}
            </Badge>
          ) : (
            <Button onClick={connect}>Connect wallet</Button>
          )}
        </header>

        {walletErr && (
          <p className="mx-6 mt-4 rounded-md bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
            {walletErr}
          </p>
        )}
        {notice && (
          <p className="mx-6 mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-foreground break-all">
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
