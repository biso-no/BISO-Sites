/**
 * Cookie-based UI preferences for anonymous (and authenticated) visitors.
 *
 * Locale and selected campus are non-sensitive UI state. Storing them in
 * cookies — rather than in an Appwrite user's `prefs` — lets unauthenticated
 * visitors keep their choice without provisioning a backend identity. This is
 * the deliberate replacement for the old "mint an anonymous Appwrite user on
 * every first request" approach, which let bots/crawlers accumulate thousands
 * of throwaway users.
 *
 * Plain (non-`"use server"`) module so it can export sync helpers/constants.
 */

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const CAMPUS_COOKIE = "campusId";

/**
 * Appwrite session cookie name. Presence of this cookie is the cheap local
 * signal that an Appwrite session *may* exist — readers must check it before
 * making any `account.*` call, because for cookieless visitors (crawlers,
 * uptime monitors, first-time users) such calls are guaranteed-401 network
 * round-trips into Appwrite. See WEB_APP_APPWRITE_INCIDENT_AUDIT.md (F-2/F-3).
 */
export const SESSION_COOKIE =
  process.env.APPWRITE_SESSION_COOKIE || "a_session_biso_web";

/**
 * The name this app used for its session cookie before 2026-08-13.
 *
 * `a_session_biso` is byte-for-byte the cookie Appwrite itself issues for
 * project `biso` (`a_session_<projectId>`). Because we scoped it to `.biso.no`
 * and Appwrite is hosted at `appwrite.biso.no`, browsers attached our session
 * to *every* top-level navigation into Appwrite — including the OAuth callback.
 * Appwrite then treated the visitor's web session as the account being signed
 * in and rejected `admin.biso.no` sign-ins with `409 user_already_exists`.
 *
 * Reads still honour it (via `APPWRITE_SESSION_COOKIE_FALLBACK`) so sessions
 * issued before the rename keep working; nothing writes it any more, and every
 * path that writes {@link SESSION_COOKIE} clears it. Safe to drop once the old
 * 30-day cookies have aged out.
 */
export const LEGACY_SESSION_COOKIE = "a_session_biso";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Attributes needed to expire a session cookie. Name, domain and path must
 * match the original `Set-Cookie` or the browser keeps the old entry alive —
 * a bare `cookies().delete(name)` omits the domain and silently no-ops in prod.
 */
export function expiredSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    path: "/",
    maxAge: 0,
    ...(isProduction ? { domain: ".biso.no" } : {}),
  };
}

export function prefCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    path: "/",
    // Non-sensitive UI state — readable client-side if ever needed.
    httpOnly: false,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    maxAge: ONE_YEAR_SECONDS,
    ...(isProduction ? { domain: ".biso.no" } : {}),
  };
}
