"use server";
import { createSessionClient } from "@repo/api/server";
import { DEFAULT_LOCALE, isLocale } from "@repo/i18n/config";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, prefCookieOptions } from "@/lib/cookie-prefs";

export async function getLocale() {
  // Cookie is the source of truth — works for anonymous visitors with no
  // Appwrite session at all.
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  // Fall back to an authenticated user's stored preference (cross-device).
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    const locale = user.prefs?.locale;
    if (isLocale(locale)) {
      return locale;
    }
  } catch {
    // No session / anonymous — fall through to the default.
  }

  return DEFAULT_LOCALE;
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  (await cookies()).set(LOCALE_COOKIE, locale, prefCookieOptions());

  // Best-effort: mirror to an authenticated user's prefs for cross-device
  // continuity. Never provisions a session for anonymous visitors.
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    await account.updatePrefs({ ...user.prefs, locale });
  } catch {
    // Anonymous or no session — the cookie is sufficient.
  }
}
