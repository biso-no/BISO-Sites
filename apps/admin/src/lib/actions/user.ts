"use server";
import { type Models, Permission, Role } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isGlobalAdmin } from "@/lib/authorization";
import { isAuthenticatedAppwriteUser, isProd } from "@/lib/utils";

function buildProfileRowPermissions(userId: string): string[] {
  const userRole = Role.user(userId);
  return [Permission.read(userRole), Permission.update(userRole)];
}

// The bi_* columns are pending an `appwrite push tables`; extend locally until
// packages/api/types/appwrite.ts is regenerated. Mirrors the pattern in
// apps/web/src/lib/actions/bi-identity.ts.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
  bi_linked_at?: string | null;
};

function isOidcIdentity(identity: { provider?: string } | undefined): boolean {
  return String(identity?.provider ?? "").toLowerCase() === "oidc";
}

/**
 * Clears the BI student link (`student_id` + the `bi_*` enrichment columns)
 * after the linked OIDC identity has been removed. Writes go through the
 * admin client — these columns are deliberately outside the self-service
 * profile-update allow-list, same as `apps/web`'s `syncBiStudentIdentity`.
 *
 * The Appwrite identity is already deleted by the time this runs, so a
 * failure here must not fail the whole unlink action — it is logged and
 * swallowed, leaving `student_id` stale until the next successful clear or
 * relink. Unlike `apps/web`, there is no membership cache here to bust.
 */
async function clearBiStudentLink(
  account: Awaited<ReturnType<typeof createSessionClient>>["account"]
) {
  try {
    const user = await account.get();
    const { db: adminDb } = await createAdminClient();

    await adminDb.updateRow<BiUser>("app", "user", user.$id, {
      student_id: null,
      bi_employee_id: null,
      bi_campus_id: null,
      bi_linked_at: null,
    });
  } catch (error) {
    console.error(
      "Failed to clear BI student link after identity removal",
      error
    );
  }
}

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

    // Determine before deleting whether this is the BI Student (OIDC)
    // identity — deleting it without clearing student_id would let a user
    // unlink and keep member status/pricing indefinitely (or hand off a
    // still-"member" account to someone else).
    const identities = await account.listIdentities().catch(() => null);
    const removedIdentity = identities?.identities.find(
      (identity) => identity.$id === identityId
    );
    const wasOidc = isOidcIdentity(removedIdentity);

    await account.deleteIdentity(identityId);

    if (wasOidc) {
      await clearBiStudentLink(account);
    }

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
      const { db: adminDb } = await createAdminClient();
      return await adminDb.createRow(
        "app",
        "user",
        user.$id,
        profile,
        buildProfileRowPermissions(user.$id)
      );
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
    const { db: adminDb } = await createAdminClient();
    return await adminDb.createRow(
      "app",
      "user",
      userId,
      profile,
      buildProfileRowPermissions(userId)
    );
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

export async function signOut(): Promise<void> {
  const { account } = await createSessionClient();

  // Revoke the server-side session best-effort, then always clear the cookie —
  // a stale/expired session must not block sign-out.
  try {
    await account.deleteSession("current");
  } catch (error) {
    console.error("Failed to delete Appwrite session on sign-out", error);
  }

  // Delete using the same domain/path the cookie was set with. A host-only
  // deletion does not clear the domain-scoped (.biso.no) production cookie,
  // which would leave the user appearing signed-in after logout.
  (await cookies()).delete({
    name: "a_session_biso_admin",
    path: "/",
    domain: isProd ? ".biso.no" : "localhost",
  });

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
