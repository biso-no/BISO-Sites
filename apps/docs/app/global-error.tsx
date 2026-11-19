"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root layout error:", error);
    // Loaded here, not at the top: this boundary is server-rendered with
    // every page, and a Sentry module missing from the build must not take
    // page rendering down with it.
    import("@sentry/nextjs")
      .then(({ captureException }) => captureException(error))
      .catch(() => {
        // Sentry is unavailable; the console.error above still records it.
      });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-semibold text-2xl">Something went wrong</h1>
        <button
          className="rounded-md border px-4 py-2 font-medium text-sm"
          onClick={() => reset()}
          type="button"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
