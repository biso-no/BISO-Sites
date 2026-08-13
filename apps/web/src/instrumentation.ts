import { logServerRequestError } from "@repo/shared/utils/server-error-logging";
import type { Instrumentation } from "next";

const EXPECTED_SESSION_COOKIE = "a_session_biso_web";
const EXPECTED_SESSION_COOKIE_FALLBACK = "a_session_biso";

/**
 * Server startup validation, mirroring `apps/admin/src/instrumentation.ts`.
 * Skipped during `next build`, where env/secrets are typically absent.
 */
export function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  // `src/lib/cookie-prefs.ts` and the shared `createSessionClient` in
  // @repo/api both resolve the cookie name from APPWRITE_SESSION_COOKIE, but
  // they default differently — this app to `a_session_biso_web`, the shared
  // package to the historical `a_session_biso`. With the var unset those two
  // disagree, so every visitor's session is written under one name and read
  // under another: a silent, total logout. Refuse to start instead.
  const sessionCookie = process.env.APPWRITE_SESSION_COOKIE?.trim();
  if (sessionCookie !== EXPECTED_SESSION_COOKIE) {
    throw new Error(
      `[web] APPWRITE_SESSION_COOKIE must be "${EXPECTED_SESSION_COOKIE}" but ` +
        `is "${sessionCookie ?? "(unset)"}". It must never be ` +
        `"${EXPECTED_SESSION_COOKIE_FALLBACK}" — that is Appwrite's own cookie ` +
        "name for this project, and on the shared .biso.no domain the browser " +
        "would replay our session to appwrite.biso.no and break OAuth sign-in. " +
        "Refusing to start."
    );
  }

  // Soft check: without the fallback, sessions issued before the rename stop
  // resolving and those visitors are logged out once. Not fatal.
  const fallback = process.env.APPWRITE_SESSION_COOKIE_FALLBACK?.trim();
  if (fallback !== EXPECTED_SESSION_COOKIE_FALLBACK) {
    console.warn(
      `[web] APPWRITE_SESSION_COOKIE_FALLBACK is "${fallback ?? "(unset)"}"; ` +
        `sessions issued under "${EXPECTED_SESSION_COOKIE_FALLBACK}" will not ` +
        "resolve and those visitors will have to sign in again."
    );
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  logServerRequestError({
    app: "web",
    context,
    error,
    request,
  });
};
