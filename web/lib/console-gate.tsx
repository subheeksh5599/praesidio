"use client";

import type { ReactNode } from "react";
import { useConsole, type ConsoleState } from "@/lib/console-context";

// Shared gate. Children is a render function that only runs once the state is
// loaded and configured — so a page never dereferences null during SSR
// prerender or the initial client fetch.
export default function ConsoleGate({
  children,
}: {
  children: (state: ConsoleState) => ReactNode;
}) {
  const { state, loading, error } = useConsole();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-sage" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-sage/60" />
          ))}
        </div>
      </div>
    );
  }

  if (error || state?.error) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold">Could not read the chain</h2>
        <p className="mt-2 break-all text-muted">{error ?? state?.error}</p>
        <p className="mt-3 text-sm text-muted">
          The Coston2 RPC is unreachable from here. Retry in a moment.
        </p>
      </div>
    );
  }

  if (!state?.configured) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold">Not configured</h2>
        <p className="mt-2 text-muted">
          Set ASSET_MANAGER, GUARDIAN_REGISTRY and FTSO_V2 in the deployment env.
          Nothing is displayed until then.
        </p>
      </div>
    );
  }

  return <>{children(state)}</>;
}
