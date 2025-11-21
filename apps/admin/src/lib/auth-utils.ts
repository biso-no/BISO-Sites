import { createSessionClient } from "@repo/api/server";

/**
 * Check if the current session belongs to an authenticated user (not anonymous)
 */
async function isAuthenticatedUser(): Promise<boolean> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();

    // In Appwrite, anonymous users have no email and their name is typically empty or a generated ID
    // We can check if the user has an email or if they have a proper name (not just an ID)
    const hasEmail = user.email && user.email.length > 0;
    const hasRealName = user.name && user.name.length > 0 && !user.name.startsWith("guest_");

    // Additional check: anonymous users typically don't have verified emails
    const isEmailVerified = user.emailVerification;

    return hasEmail || (hasRealName && isEmailVerified);
  } catch (error) {
    console.error("Error checking authentication status:", error);
    return false;
  }
}

/**
 * Check if there's any session (anonymous or authenticated)
 */
async function hasAnySession(): Promise<boolean> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    return !!user.$id;
  } catch (error) {
    return false;
  }
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

    const hasEmail = user.email && user.email.length > 0;
    const hasRealName = user.name && user.name.length > 0 && !user.name.startsWith("guest_");
    const isEmailVerified = user.emailVerification;

    const isAuthenticated = hasEmail || (hasRealName && isEmailVerified);

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
