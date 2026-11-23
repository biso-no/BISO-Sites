import { logServerRequestError } from "@repo/shared/utils/server-error-logging";
import type { captureRequestError } from "@sentry/nextjs";
import type { Instrumentation } from "next";

// Set once Sentry has loaded. @sentry/nextjs is bundled into the build, so a
// missing package fails the build; the catch in register() covers Sentry
// failing to load or start at run time, and the Site then runs without it.
let captureRequest: typeof captureRequestError | undefined;

export async function register() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_RUNTIME !== "nodejs"
  ) {
    return;
  }
  try {
    const sentry = await import("@sentry/nextjs");
    await import("./sentry.server.config");
    captureRequest = sentry.captureRequestError;
  } catch (error) {
    console.error("[docs] Sentry failed to load; running without it", error);
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  logServerRequestError({
    app: "docs",
    context,
    error,
    request,
  });
  captureRequest?.(error, request, context);
};
