"use server";
import type { Models } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { cookies } from "next/headers";

const _BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

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

    if (user.$id) {
      // Check if this is an authenticated user (not anonymous)
      const hasEmail = user.email && user.email.length > 0;
      const hasRealName =
        user.name && user.name.length > 0 && !user.name.startsWith("guest_");
      const isEmailVerified = user.emailVerification;

      const isAuthenticated = hasEmail || (hasRealName && isEmailVerified);

      // Only return user data for authenticated users
      if (!isAuthenticated) {
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
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting logged in user!!", error);
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to remove identity", error);
    return { success: false, error: message };
  }
}

// Fields users may edit themselves via updateProfile. Everything else on
// the Users row (roles, isActive, campus_id, department_ids,
// membership_ids, student_id, email) is managed elsewhere — by the
// Microsoft / 24SO sync, by dedicated server actions, or by the admin
// CMS — so we don't accept caller-supplied writes to those columns.
const PROFILE_WRITABLE_FIELDS = [
  "name",
  "phone",
  "address",
  "city",
  "zip",
  "bank_account",
  "swift",
  "avatar",
  "bio",
  "is_public",
] as const satisfies readonly (keyof Users)[];

type WritableProfileField = (typeof PROFILE_WRITABLE_FIELDS)[number];

function pickWritableProfileFields(
  input: Partial<Users>
): Partial<Pick<Users, WritableProfileField>> {
  const result: Partial<Pick<Users, WritableProfileField>> = {};
  for (const key of PROFILE_WRITABLE_FIELDS) {
    if (key in input) {
      // The conditional cast keeps the narrow per-key type from Users.
      result[key] = input[key] as never;
    }
  }
  return result;
}

export async function updateProfile(profile: Partial<Users>) {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get();

    const writable = pickWritableProfileFields(profile);

    try {
      await db.getRow("app", "user", user.$id);
      if (typeof writable.name === "string" && writable.name.length > 0) {
        await account.updateName(writable.name);
      }
      return await db.updateRow("app", "user", user.$id, writable);
    } catch {
      return await db.createRow("app", "user", user.$id, writable);
    }
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return null;
  }
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

export async function deleteUserData() {
  const { account } = await createSessionClient();
  const { users } = await createAdminClient();
  const user = await account.get();
  await users.delete(user.$id);
  return true;
}
