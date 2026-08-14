"use client";

import type { ReactNode } from "react";
import { useConsole, type ConsoleState } from "@/lib/console-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
        <Skeleton className="h-7 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (error || state?.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not read the chain</CardTitle>
          <CardDescription className="break-all">{error ?? state?.error}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The Coston2 RPC is unreachable from here. Retry in a moment.
        </CardContent>
      </Card>
    );
  }

  if (!state?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not configured</CardTitle>
          <CardDescription>
            Set ASSET_MANAGER, GUARDIAN_REGISTRY and FTSO_V2 in the deployment env.
            Nothing is displayed until then.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <>{children(state)}</>;
}
