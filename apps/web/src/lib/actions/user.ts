"use server";
import { ID, type Models, OAuthProvider } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
//
export async function getLoggedInUser(): Promise<{
  user: Models.User<Models.Preferences>;
  profile: Users | null;
} | null> {
  try {
    const cookiesStore = await cookies();
    const session = cookiesStore.get("a_session_biso");
    if (!session) {
      return null;
    }
    const { account, db } = await createSessionClient();

    const user = await account.get();
    console.log("user authenticated:", user.$id);

    if (user.$id) {
      // Check if this is an authenticated user (not anonymous)
      const hasEmail = user.email && user.email.length > 0;
      const hasRealName =
        user.name && user.name.length > 0 && !user.name.startsWith("guest_");
      const isEmailVerified = user.emailVerification;

      const isAuthenticated = hasEmail || (hasRealName && isEmailVerified);

      // Only return user data for authenticated users
      if (!isAuthenticated) {
        console.log("Anonymous user detected, not returning user data");
        return null;
      }

      try {
        // Try to get the user profile document
        const profile = await db.getRow<Users>("app", "user", user.$id);
        return { user, profile };
      } catch (profileError) {
        // If profile doesn't exist, return user but null profile
        console.log("No profile found for user:", user.$id);
        console.error("Profile error:", profileError);
        return { user, profile: null };
      }
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting logged in user!!", error);
    return null;
  }
}

async function _getCurrentSession() {
  const { account } = await createSessionClient();
  const session = await account.getSession("current");
  return session;
}

async function _getUserById(
  _userId: string
): Promise<Models.User<Models.Preferences> | null> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    return user;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function _signIn(email: string) {
  try {
    const { account } = await createSessionClient();
    const user = await account.createMagicURLToken(
      ID.unique(),
      email,
      `${BASE_URL}/auth/callback`
    );
    return user;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function _signInWithOauth() {
  const { account } = await createSessionClient();

  const origin = (await headers()).get("origin");

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Microsoft,
    `${origin}/auth/oauth`,
    `${origin}/auth/login`,
    ["openid", "email", "profile"]
  );

  return redirect(redirectUrl);
}

export async function listIdentities() {
  try {
    const { account } = await createSessionClient();
    const identities = await account.listIdentities();
    return identities;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function removeIdentity(identityId: string) {
  try {
    const { account } = await createSessionClient();
    await account.deleteIdentity(identityId);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove identity", error);
    return { success: false, error: String((error as any)?.message || error) };
  }
}

type ProfileDetails = {
  department?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
  bank_account?: string;
  swift?: string;
};

export async function updateProfile(profile: Partial<Users>) {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get();

    console.log("Updating profile for user:", user.$id);
    console.log("Profile data being sent:", JSON.stringify(profile));

    try {
      const existingProfile = await db.getRow("app", "user", user.$id);
      console.log("Profile found, updating...", existingProfile.$id);
      if (profile.name) {
        await account.updateName(profile.name);
      }
      return await db.updateRow("app", "user", user.$id, profile);
    } catch (profileError) {
      console.log(
        "Profile not found, creating new profile for user:",
        user.$id
      );
      console.error("Profile lookup error details:", profileError);
      return await db.createRow("app", "user", user.$id, profile);
    }
  } catch (error) {
    console.error("Error in updateProfile:", error);
    // Check if it's a specific Appwrite error we can handle
    if (typeof error === "object" && error !== null && "code" in error) {
      console.error(`Appwrite error code: ${error.code}`);
    }
    return null;
  }
}

async function _createProfile(profile: Partial<Users>, userId: string) {
  try {
    const { account, db } = await createSessionClient();

    const existingProfile = await db.getRow("app", "user", userId);

    if (existingProfile) {
      return await db.updateRow("app", "user", userId, profile);
    }
    return await db.createRow("app", "user", userId, profile);
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function _getUserPreferences(
  _userId: string
): Promise<Models.Preferences | null> {
  const { account, db } = await createSessionClient();
  const user = await account.get();

  if (!user) {
    return null;
  }

  const prefs = user.prefs;
  return prefs;
}

async function _updateUserPreferences(
  _userId: string,
  prefs: Record<string, any>
): Promise<Models.Preferences | null> {
  const { account, db } = await createSessionClient();
  const user = await account.get();

  if (!user) {
    return null;
  }

  // Merge existing preferences with new ones
  const existingPrefs = user.prefs || {};
  const mergedPrefs = { ...existingPrefs, ...prefs };

  const updatedPrefs = await account.updatePrefs(mergedPrefs);
  return updatedPrefs;
}

async function _createJWT(): Promise<string | null> {
  try {
    const { account } = await createSessionClient();
    const jwt = await account.createJWT();
    return jwt.jwt;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function _signOut(): Promise<void> {
  const { account } = await createSessionClient();

  (await cookies()).delete("a_session_biso");
  await account.deleteSession("current");

  redirect("/auth/login");
}

export async function deleteUserData() {
  const { account } = await createSessionClient();
  const { users } = await createAdminClient();
  const user = await account.get();
  await users.delete(user.$id);
  return true;
}
