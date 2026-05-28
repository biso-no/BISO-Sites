"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the root layout itself (where the regular
 * error.tsx boundary cannot run because it lives inside that layout).
 * Renders its own <html><body> tree per Next.js requirements.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "Global error boundary caught:",
      error.digest ?? error.message
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#0b1226",
          color: "#fff",
          display: "flex",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <p
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.25em",
              opacity: 0.6,
              textTransform: "uppercase",
            }}
          >
            500
          </p>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 600,
              marginTop: "0.5rem",
            }}
          >
            The application failed to start
          </h1>
          <p style={{ marginTop: "0.75rem", opacity: 0.8 }}>
            Please refresh the page. If the problem persists, contact
            contact@biso.no.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "0.75rem",
                marginTop: "1rem",
                opacity: 0.5,
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
