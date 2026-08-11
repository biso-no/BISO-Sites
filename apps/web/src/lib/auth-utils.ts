import type { Models } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { isLocale } from "@repo/i18n/config";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { CAMPUS_COOKIE, LOCALE_COOKIE, SESSION_COOKIE } from "./cookie-prefs";
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
    // No session cookie → no session. Skip the guaranteed-401 account.get().
    if (!(await cookies()).get(SESSION_COOKIE)) {
      return {
        hasSession: false,
        isAuthenticated: false,
        isAnonymous: false,
      };
    }
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
    // Preserve Next.js control-flow signals (prerender bailout, redirect)
    // thrown by cookies() — swallowing them corrupts prerendering.
    unstable_rethrow(error);
    console.error("Error getting auth status:", error);
    return {
      hasSession: false,
      isAuthenticated: false,
      isAnonymous: false,
    };
  }
}

/**
 * Request-memoized: several layouts/pages read preferences in one render.
 * Only consults Appwrite when a session cookie exists — for cookieless
 * visitors `getPrefs()` is a guaranteed-401 round-trip.
 */
export const getUserPreferences = cache(
  async (): Promise<UserPreferences | null> => {
    const cookieStore = await cookies();
    const cookieCampus = cookieStore.get(CAMPUS_COOKIE)?.value;
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

    let accountPrefs: UserPreferences | null = null;
    if (cookieStore.get(SESSION_COOKIE)) {
      try {
        const { account } = await createSessionClient();
        accountPrefs = await account.getPrefs<UserPreferences>();
      } catch {
        accountPrefs = null;
      }
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
);
