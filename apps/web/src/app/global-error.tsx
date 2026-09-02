"use client";

import { useEffect } from "react";

// global-error.tsx catches errors thrown inside the root app/layout.tsx
// itself (or before it renders). It MUST render its own <html> and
// <body> because the root layout is the thing that crashed. Sub-route
// errors are caught by the per-segment error.tsx boundaries instead.
/**
 * RD-032 left this English on purpose. `global-error.tsx` replaces the **root
 * layout** when it renders, which is where `NextIntlClientProvider` lives — so
 * there is no locale and no message bundle available here by construction.
 * Every other user-facing string in `apps/web` is translated; this one cannot
 * be without loading messages by hand in a boundary that exists precisely
 * because everything else has already failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root layout error:", error);
  }, [error]);

  return (
    <html lang="no">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ marginBottom: 20, color: "#666" }}>
            An unexpected error occurred. Please try again, or return to{" "}
            <a href="/">the home page</a>.
          </p>
          <button onClick={reset} type="button">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
