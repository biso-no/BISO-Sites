"use client";

import { Button } from "@repo/ui/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

// Default error boundary for the public site. More specific boundaries
// (e.g. (public)/jobs/[slug]/error.tsx) take precedence inside their
// own segment; everything else falls back to this one so a thrown
// error in a Server Component renders a styled page instead of the
// default Next.js error UI.
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Public route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-destructive" />
      <h2 className="mb-2 font-semibold text-xl">Something went wrong</h2>
      <p className="mb-6 max-w-sm text-muted-foreground text-sm">
        We couldn't load this page. Please try again, or return to the home
        page.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild>
          <Link href="/">Go to home page</Link>
        </Button>
      </div>
    </div>
  );
}
