"use client";

import { useEffect } from "react";
import { museoSans, museoSlab } from "./fonts";

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
    <html className={`${museoSans.variable} ${museoSlab.variable}`} lang="no">
      <body
        style={{
          // Museo, like every other page. The root layout that normally
          // applies the faces is the thing that failed, so this boundary
          // loads them itself.
          fontFamily: "var(--font-museo), system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily:
                "var(--font-museo-slab), var(--font-museo), sans-serif",
              marginBottom: 12,
            }}
          >
            Something went wrong
          </h1>
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
