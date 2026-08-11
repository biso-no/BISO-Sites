"use server";
import { createSessionClient } from "@repo/api/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@repo/i18n/config";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  LOCALE_COOKIE,
  prefCookieOptions,
  SESSION_COOKIE,
} from "@/lib/cookie-prefs";

/**
 * Request-memoized locale resolution. `getLocale()` is called from the root
 * layout, `i18n/request.ts`, pages, and components in the same render —
 * `cache()` collapses those into a single execution per request.
 */
const resolveLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();

  // Cookie is the source of truth — works for anonymous visitors with no
  // Appwrite session at all.
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  // Fall back to an authenticated user's stored preference (cross-device) —
  // but only when a session cookie exists. Without one, `account.get()` is a
  // guaranteed-401 round-trip into Appwrite for every crawler/monitor hit.
  if (cookieStore.get(SESSION_COOKIE)) {
    try {
      const { account } = await createSessionClient();
      const user = await account.get();
      const locale = user.prefs?.locale;
      if (isLocale(locale)) {
        return locale;
      }
    } catch {
      // Invalid/expired session — fall through to the default.
    }
  }

  return DEFAULT_LOCALE;
});

// biome-ignore lint/suspicious/useAwait: async required by "use server" — returns memoized promise
export async function getLocale() {
  return resolveLocale();
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, prefCookieOptions());

  // Best-effort: mirror to an authenticated user's prefs for cross-device
  // continuity. Skipped entirely for sessionless visitors — the cookie is
  // sufficient and the Appwrite call could only 401.
  if (!cookieStore.get(SESSION_COOKIE)) {
    return;
  }
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    await account.updatePrefs({ ...user.prefs, locale });
  } catch {
    // Anonymous or expired session — the cookie is sufficient.
  }
}
