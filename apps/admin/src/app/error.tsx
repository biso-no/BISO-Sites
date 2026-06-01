"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import {
  buttonStyle,
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
} from "./(portal)/_components/studio";

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
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16"
      style={{ background: STUDIO.paper }}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-[0.1em]"
          style={{
            background: "rgba(107,30,30,0.06)",
            borderColor: "rgba(107,30,30,0.2)",
            color: STUDIO.claret,
            fontFamily: MONO_STACK,
          }}
        >
          <AlertTriangle size={12} />
          <span>500 · Server error</span>
        </div>

        {/* Icon */}
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl border"
          style={{
            background: "rgba(107,30,30,0.06)",
            borderColor: "rgba(107,30,30,0.18)",
            color: STUDIO.claret,
          }}
        >
          <AlertTriangle size={28} />
        </div>

        {/* Heading + body */}
        <div className="space-y-3">
          <h1
            className="text-4xl leading-tight md:text-5xl"
            style={{
              color: STUDIO.ink,
              fontFamily: SERIF_STACK,
              fontWeight: 400,
            }}
          >
            Something went wrong
          </h1>
          <p className="text-sm leading-6" style={{ color: STUDIO.ink3 }}>
            An unexpected error occurred. Try again in a moment, or head back to
            the dashboard.
          </p>
          {error.digest && (
            <p
              className="text-xs"
              style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium text-sm transition hover:opacity-90"
            onClick={reset}
            style={buttonStyle("primary")}
            type="button"
          >
            <RotateCcw size={15} />
            Try again
          </button>
          <a
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium text-sm transition hover:opacity-90"
            href="/"
            style={buttonStyle("secondary")}
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
