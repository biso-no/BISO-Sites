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
