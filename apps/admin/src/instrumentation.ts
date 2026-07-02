/**
 * Server startup validation. Runs once when a server instance boots (Next.js
 * instrumentation hook). Fails fast on misconfiguration that would otherwise
 * surface as confusing runtime errors — or, in the case of the session cookie,
 * as a silent security problem.
 *
 * Skipped during `next build` (env/secrets are typically absent there); the
 * checks run for the dev server and the production runtime.
 */

import { logServerRequestError } from "@repo/shared/utils/server-error-logging";
import type { Instrumentation } from "next";

const EXPECTED_SESSION_COOKIE = "a_session_biso_admin";

// Vars the admin app genuinely cannot function without.
const REQUIRED_ENV = ["APPWRITE_API_KEY", "NEXT_PUBLIC_BASE_URL"] as const;

// Vars with prod fallbacks in @repo/api — fine to omit locally, but a missing
// value silently targets production Appwrite, which is risky for staging.
const RECOMMENDED_ENV = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT",
] as const;

export function register() {
  // Don't fail the build — only validate at server start / runtime.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[admin] Missing required environment variables: ${missing.join(", ")}.`
    );
  }

  // Security-critical: the admin app shares the .biso.no domain with the public
  // web app (cookie "a_session_biso"). The shared createSessionClient resolves
  // the session cookie name from APPWRITE_SESSION_COOKIE and falls back to the
  // web cookie when unset — so a missing/incorrect value here would make admin
  // read the user's private web session. Refuse to start in that state.
  const sessionCookie = process.env.APPWRITE_SESSION_COOKIE?.trim();
  if (sessionCookie !== EXPECTED_SESSION_COOKIE) {
    throw new Error(
      `[admin] APPWRITE_SESSION_COOKIE must be "${EXPECTED_SESSION_COOKIE}" ` +
        `but is "${sessionCookie ?? "(unset)"}". An incorrect value would make ` +
        "the admin app read the public web app's session cookie on the shared " +
        ".biso.no domain. Refusing to start."
    );
  }

  const missingRecommended = RECOMMENDED_ENV.filter(
    (key) => !process.env[key]?.trim()
  );
  if (missingRecommended.length > 0) {
    console.warn(
      `[admin] Falling back to production Appwrite defaults for unset env: ${missingRecommended.join(
        ", "
      )}.`
    );
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  logServerRequestError({
    app: "admin",
    context,
    error,
    request,
  });
};
