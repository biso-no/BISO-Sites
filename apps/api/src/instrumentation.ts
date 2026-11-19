import { logServerRequestError } from "@repo/shared/utils/server-error-logging";
import type { captureRequestError } from "@sentry/nextjs";
import type { Instrumentation } from "next";

// Set once Sentry has loaded. Sentry is never load-critical: if one of its
// modules is missing from the build, the Site runs without it.
let captureRequest: typeof captureRequestError | undefined;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  try {
    const sentry = await import("@sentry/nextjs");
    await import("./sentry.server.config");
    captureRequest = sentry.captureRequestError;
  } catch (error) {
    console.error("[api] Sentry failed to load; running without it", error);
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  logServerRequestError({
    app: "api",
    context,
    error,
    request,
  });
  captureRequest?.(error, request, context);
};
