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
  process.env.APPWRITE_SESSION_COOKIE || "a_session_biso";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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
