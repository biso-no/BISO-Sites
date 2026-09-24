"use server";
import { appwriteErrorStatus } from "@repo/api/errors";
import { createSessionClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { isAuthenticatedAppwriteUser } from "./utils";

const UNAUTHORIZED = 401;

const LOGGED_OUT = {
  hasSession: false,
  isAuthenticated: false,
  isAnonymous: false,
} as const;

/** The session's user, or null when Appwrite rejects the session (401). */
async function fetchSessionUser() {
  try {
    const { account } = await createSessionClient();
    return await account.get();
  } catch (error) {
    if (appwriteErrorStatus(error) === UNAUTHORIZED) {
      return null;
    }
    throw error;
  }
}

/**
 * Get user authentication status. Used by /api/auth/check and the login page.
 * Resolves to hasSession + isAuthenticated + isAnonymous flags.
 *
 * Only "no session cookie" and an Appwrite 401 (expired/invalid session) mean
 * logged-out. Any other failure (outage, timeout, 5xx) is rethrown so callers
 * can answer "unknown" instead of wrongly reporting the user as logged out.
 */
export async function getAuthStatus(): Promise<{
  hasSession: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
}> {
  const availableCookies = await cookies();
  const adminCookie = availableCookies.get("a_session_biso_admin");
  if (!adminCookie) {
    return { ...LOGGED_OUT };
  }

  const user = await fetchSessionUser();
  if (!user?.$id) {
    return { ...LOGGED_OUT };
  }

  const isAuthenticated = isAuthenticatedAppwriteUser(user);

  return {
    hasSession: true,
    isAuthenticated,
    isAnonymous: !isAuthenticated,
  };
}
