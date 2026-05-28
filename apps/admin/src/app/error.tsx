"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught:", error.digest ?? error.message);
  }, [error]);

  return (
    <main
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden",
        "bg-linear-to-br from-primary-100 via-blue-strong to-blue-accent text-white"
      )}
    >
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em]">
          <AlertTriangle className="h-4 w-4" />
          <span>Something went wrong</span>
        </div>

        <div className="space-y-4">
          <p className="font-medium text-sm text-white/70 uppercase tracking-[0.25em]">
            500
          </p>
          <h1 className="max-w-xl font-semibold text-4xl text-white leading-tight md:text-5xl">
            We hit an unexpected error
          </h1>
          <p className="max-w-2xl text-base text-white/80 md:text-lg">
            The team has been notified. Try again in a moment, or head back to
            the dashboard.
          </p>
          {error.digest ? (
            <p className="font-mono text-white/50 text-xs">
              Reference: {error.digest}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            className="bg-white text-primary-100 hover:bg-white/90"
            onClick={reset}
            size="lg"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Try again
          </Button>
          <Button
            asChild
            className="border border-white/40 bg-white/10 text-white hover:bg-white/20"
            size="lg"
            variant="ghost"
          >
            <a href="/">
              <Home className="mr-2 h-5 w-5" />
              Back to dashboard
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
