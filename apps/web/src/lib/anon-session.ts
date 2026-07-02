import { createAdminClient, createSessionClient } from "@repo/api/server";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME =
  process.env.APPWRITE_SESSION_COOKIE || "a_session_biso";

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
  const existingCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (existingCookie) {
    try {
      const { account } = await createSessionClient(existingCookie.value);
      await account.get();
      return true;
    } catch {
      cookieStore.delete(SESSION_COOKIE_NAME);
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
