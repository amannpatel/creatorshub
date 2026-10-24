"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We couldn&apos;t load this page. If this keeps happening, check that the database is reachable and environment variables are set.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
