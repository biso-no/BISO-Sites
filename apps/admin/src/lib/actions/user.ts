"use server";
import type { Models } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserAuthContext, isGlobalAdmin } from "@/lib/authorization";
import { isAuthenticatedAppwriteUser } from "@/lib/utils";

export async function getLoggedInUser(): Promise<{
  user: Models.User<Models.Preferences>;
  profile: Users | null;
} | null> {
  try {
    const cookiesStore = await cookies();
    const session = cookiesStore.get("a_session_biso_admin");
    if (!session) {
      return null;
    }
    const { account, db } = await createSessionClient();

    const user = await account.get();

    // Only return user data for authenticated (non-anonymous) users.
    if (!isAuthenticatedAppwriteUser(user)) {
      return null;
    }

    try {
      // Try to get the user profile document
      const profile = await db.getRow<Users>("app", "user", user.$id);
      return { user, profile };
    } catch {
      // If profile doesn't exist, return user but null profile
      return { user, profile: null };
    }
  } catch {
    return null;
  }
}

async function _getCurrentSession() {
  const { account } = await createSessionClient();
  const session = await account.getSession("current");
  return session;
}

export async function getUserById(userId: string): Promise<Users | null> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return null;
  }
  // Only admins may look up arbitrary user rows by id; everyone else may only
  // resolve their own profile through this server action.
  const isAdmin =
    ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin");
  if (!(isAdmin || ctx.userId === userId)) {
    return null;
  }
  try {
    const { db } = await createAdminClient();
    const user = await db.getRow<Users>("app", "user", userId);
    return user;
  } catch {
    console.error("Failed to fetch user by id");
    return null;
  }
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
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateProfile(profile: Partial<Users>) {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get();

    try {
      await db.getRow("app", "user", user.$id);
      if (profile.name) {
        await account.updateName(profile.name);
      }
      return await db.updateRow("app", "user", user.$id, profile);
    } catch {
      return await db.createRow("app", "user", user.$id, profile);
    }
  } catch (error) {
    console.error("updateProfile failed");
    // Check if it's a specific Appwrite error we can handle
    if (typeof error === "object" && error !== null && "code" in error) {
      console.error(`Appwrite error code: ${error.code}`);
    }
    return null;
  }
}

async function _createProfile(profile: Partial<Users>, userId: string) {
  try {
    const { db } = await createSessionClient();

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
  const { account } = await createSessionClient();
  const user = await account.getPrefs();

  if (!user) {
    return null;
  }

  const prefs = user.prefs;
  return prefs;
}

async function _updateUserPreferences(
  _userId: string,
  prefs: Record<string, unknown>
): Promise<Models.Preferences | null> {
  const { account } = await createSessionClient();
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

export async function createJWT(): Promise<string | null> {
  try {
    const { account } = await createSessionClient();
    const jwt = await account.createJWT();
    return jwt.jwt;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function signOut(): Promise<void> {
  const { account } = await createSessionClient();

  (await cookies()).delete("a_session_biso_admin");
  await account.deleteSession("current");

  redirect("/auth/login");
}

export async function deleteUserData(): Promise<boolean> {
  const { account } = await createSessionClient();
  const { users, db } = await createAdminClient();
  const user = await account.get();
  if (!user) {
    return false;
  }

  // Must be admin to delete user
  if (!(await isGlobalAdmin())) {
    return false;
  }

  const deletedUserDoc = await db.deleteRow("app", "user", user.$id);
  if (!deletedUserDoc) {
    return false;
  }
  const deletedUser = await users.delete(user.$id);
  return Boolean(deletedUser);
}
