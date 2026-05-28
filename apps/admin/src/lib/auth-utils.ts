"use server";
import { createSessionClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { isAuthenticatedAppwriteUser } from "./utils";

/**
 * Get user authentication status. Used by /api/auth/check and the login page.
 * Resolves to hasSession + isAuthenticated + isAnonymous flags, never throws.
 */
export async function getAuthStatus(): Promise<{
  hasSession: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
}> {
  try {
    const availableCookies = await cookies();
    const adminCookie = availableCookies.get("a_session_biso_admin");
    if (!adminCookie) {
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

    const isAuthenticated = isAuthenticatedAppwriteUser(user);

    return {
      hasSession: true,
      isAuthenticated,
      isAnonymous: !isAuthenticated,
    };
  } catch {
    return {
      hasSession: false,
      isAuthenticated: false,
      isAnonymous: false,
    };
  }
}
