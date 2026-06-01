"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the root layout itself (where the regular
 * error.tsx boundary cannot run because it lives inside that layout).
 * Renders its own <html><body> tree per Next.js requirements.
 * Uses inline styles only — Tailwind/CSS modules are not available here.
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
          background: "#faf7f2",
          color: "#1a1814",
          display: "flex",
          fontFamily:
            '"Cormorant Garamond", "EB Garamond", Georgia, Times New Roman, serif',
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
              color: "#6b1e1e",
              fontFamily:
                '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
              fontSize: "0.7rem",
              letterSpacing: "0.18em",
              marginBottom: "1rem",
              textTransform: "uppercase",
            }}
          >
            500 · Application error
          </p>
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 400,
              lineHeight: 1.1,
              marginBottom: "0.75rem",
            }}
          >
            The application failed to start
          </h1>
          <p
            style={{
              color: "#6b6357",
              fontSize: "0.875rem",
              lineHeight: 1.65,
              marginBottom: "1.5rem",
            }}
          >
            Please refresh the page. If the problem persists, contact{" "}
            <a
              href="mailto:contact@biso.no"
              style={{ color: "#6b1e1e", textDecoration: "underline" }}
            >
              contact@biso.no
            </a>
            .
          </p>
          {error.digest ? (
            <p
              style={{
                color: "#9c9385",
                fontFamily:
                  '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
                fontSize: "0.7rem",
                marginTop: "0.5rem",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <div style={{ marginTop: "2rem" }}>
            <a
              href="/"
              style={{
                background: "#1a1814",
                borderRadius: "0.625rem",
                color: "#faf7f2",
                display: "inline-block",
                fontSize: "0.875rem",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 500,
                padding: "0.625rem 1.25rem",
                textDecoration: "none",
              }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
