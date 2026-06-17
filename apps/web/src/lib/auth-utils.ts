import type { Models } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { isLocale } from "@repo/i18n/config";
import { cookies } from "next/headers";
import { CAMPUS_COOKIE, LOCALE_COOKIE } from "./cookie-prefs";
import type { UserPreferences } from "./types/prefs";

/**
 * Canonical rule for whether an Appwrite account represents a real
 * authenticated user (as opposed to an anonymous middleware-provisioned
 * session). Anonymous sessions still have a $id, but no email and a
 * generated `guest_*` name. Single source of truth — do not reimplement.
 */
export function isAuthenticatedAccount(
  account: Models.User<Models.Preferences> | null | undefined
): boolean {
  if (!account?.$id) {
    return false;
  }
  const hasEmail = !!account.email && account.email.length > 0;
  const hasRealName =
    !!account.name &&
    account.name.length > 0 &&
    !account.name.startsWith("guest_");
  return hasEmail || (hasRealName && account.emailVerification);
}

/**
 * Get user authentication status
 */
export async function getAuthStatus(): Promise<{
  hasSession: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
}> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();

    if (!user.$id) {
      return {
        hasSession: false,
        isAuthenticated: false,
        isAnonymous: false,
      };
    }

    const isAuthenticated = isAuthenticatedAccount(user);

    return {
      hasSession: true,
      isAuthenticated,
      isAnonymous: !isAuthenticated,
    };
  } catch (error) {
    console.error("Error getting auth status:", error);
    return {
      hasSession: false,
      isAuthenticated: false,
      isAnonymous: false,
    };
  }
}

export async function getUserPreferences(): Promise<UserPreferences | null> {
  const cookieStore = await cookies();
  const cookieCampus = cookieStore.get(CAMPUS_COOKIE)?.value;
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  let accountPrefs: UserPreferences | null = null;
  try {
    const { account } = await createSessionClient();
    accountPrefs = await account.getPrefs<UserPreferences>();
  } catch {
    accountPrefs = null;
  }

  // No authenticated prefs and no cookie selection → nothing to report.
  if (!(accountPrefs || cookieCampus || cookieLocale)) {
    return null;
  }

  // Overlay cookie-based selection so anonymous (sessionless) visitors keep
  // their campus/locale choice without an Appwrite user. Cookies win because
  // they reflect the most recent in-browser action.
  const merged: UserPreferences = { ...(accountPrefs ?? {}) };
  if (cookieCampus) {
    merged.campusId = cookieCampus;
  }
  if (isLocale(cookieLocale)) {
    merged.locale = cookieLocale;
  }
  return merged;
}
