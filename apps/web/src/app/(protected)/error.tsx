"use client";

import { Button } from "@repo/ui/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

// Default error boundary for the authenticated tree. The (protected)
// layout's `unauthorized()` call short-circuits to the unauthorized
// page before this fires, so this only sees true runtime errors from
// authenticated routes.
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Protected route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-destructive" />
      <h2 className="mb-2 font-semibold text-xl">Something went wrong</h2>
      <p className="mb-6 max-w-sm text-muted-foreground text-sm">
        We couldn't load this page. Please try again, or return to your profile.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild>
          <Link href="/profile">Go to profile</Link>
        </Button>
      </div>
    </div>
  );
}
