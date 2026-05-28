"use client";

import { Button } from "@repo/ui/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "Portal error boundary caught:",
      error.digest ?? error.message
    );
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-700 text-xs uppercase tracking-[0.2em]">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Workspace error</span>
      </div>
      <h1 className="mt-6 max-w-xl font-semibold text-2xl">
        This view couldn&apos;t load.
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground text-sm">
        The page failed to render. Try again, or pick a different workspace from
        the sidebar.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-muted-foreground text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
      <Button className="mt-6" onClick={reset} size="sm">
        <RotateCcw className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
