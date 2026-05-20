"use client";

import { Button } from "@repo/ui/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function JobError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Job page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-destructive" />
      <h2 className="mb-2 font-semibold text-xl">Something went wrong</h2>
      <p className="mb-6 max-w-sm text-muted-foreground text-sm">
        We couldn't load this vacancy. Try again or browse all open positions.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild>
          <Link href="/jobs">Browse vacancies</Link>
        </Button>
      </div>
    </div>
  );
}
