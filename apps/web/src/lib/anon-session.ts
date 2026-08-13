import { createAdminClient, createSessionClient } from "@repo/api/server";
import { cookies } from "next/headers";
import {
  expiredSessionCookieOptions,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE as SESSION_COOKIE_NAME,
} from "@/lib/cookie-prefs";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    path: "/",
    httpOnly: true,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    maxAge: THIRTY_DAYS_SECONDS,
    ...(isProduction ? { domain: ".biso.no" } : {}),
  };
}

/**
 * Expire the pre-rename cookie so the browser stops sending our session to
 * appwrite.biso.no under Appwrite's own cookie name. No-op when absent, so
 * repeat calls cost nothing. See LEGACY_SESSION_COOKIE in `cookie-prefs.ts`.
 */
function retireLegacySessionCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  legacyCookie: { value: string } | undefined
) {
  if (legacyCookie) {
    cookieStore.set(LEGACY_SESSION_COOKIE, "", expiredSessionCookieOptions());
  }
}

/**
 * Lazily provision an anonymous Appwrite session, but only when a feature
 * genuinely needs a per-user identity (e.g. cart reservations, signups).
 *
 * This is the deliberate replacement for eager provisioning in middleware:
 * bots and crawlers never reach the actions that call this, so junk anonymous
 * users stop accumulating. If a session cookie already exists (anonymous or
 * authenticated), this is a no-op.
 *
 * Must be called from a Server Action or Route Handler — it sets a cookie.
 * Within the same request, a subsequent `createSessionClient()` call will read
 * the freshly-set cookie, so callers can provision then immediately use it.
 *
 * @returns `true` if a session exists/was created, `false` on failure.
 */
export async function ensureAnonymousSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const currentCookie = cookieStore.get(SESSION_COOKIE_NAME);
  // Sessions issued before the cookie rename still live under the old name.
  const legacyCookie = cookieStore.get(LEGACY_SESSION_COOKIE);
  const existingCookie = currentCookie ?? legacyCookie;
  if (existingCookie) {
    try {
      // No-arg call so the cookie value is applied via setSession — the
      // parameter of createSessionClient is a JWT, not a session secret.
      const { account } = await createSessionClient();
      await account.get();
      if (!currentCookie) {
        // Carry the still-valid session over to the current cookie name.
        cookieStore.set(
          SESSION_COOKIE_NAME,
          existingCookie.value,
          sessionCookieOptions()
        );
      }
      retireLegacySessionCookie(cookieStore, legacyCookie);
      return true;
    } catch {
      cookieStore.set(SESSION_COOKIE_NAME, "", expiredSessionCookieOptions());
      retireLegacySessionCookie(cookieStore, legacyCookie);
    }
  }

  try {
    const { account } = await createAdminClient();
    const session = await account.createAnonymousSession();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      session.secret,
      sessionCookieOptions()
    );
    return true;
  } catch (error) {
    console.error("Failed to create anonymous session:", error);
    return false;
  }
}
