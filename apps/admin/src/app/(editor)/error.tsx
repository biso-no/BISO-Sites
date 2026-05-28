"use client";

import { Button } from "@repo/ui/components/ui/button";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "Editor error boundary caught:",
      error.digest ?? error.message
    );
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-rose-700 text-xs uppercase tracking-[0.2em]">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Editor error</span>
      </div>
      <h1 className="mt-6 max-w-xl font-semibold text-2xl">
        The page editor crashed.
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground text-sm">
        Unsaved changes may be lost. Try reloading the editor, or go back to
        the pages list.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-muted-foreground text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button onClick={reset} size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reload editor
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href="/pages">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to pages
          </a>
        </Button>
      </div>
    </div>
  );
}
