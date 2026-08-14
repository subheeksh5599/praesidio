"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Error boundary for the console. A chain read failure or a crash renders a
// recoverable state instead of a blank screen.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-xl px-6">
      <Card className="text-center">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>The console hit an unexpected error. Retry the read.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>Retry</Button>
        </CardContent>
      </Card>
    </div>
  );
}
