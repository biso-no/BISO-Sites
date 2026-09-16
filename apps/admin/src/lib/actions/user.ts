"use server";
import type { Models } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import {
  buildProfileRowPermissions,
  pickSelfServiceProfileFields,
} from "@repo/shared/utils/profile-fields";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isGlobalAdmin } from "@/lib/authorization";
import { isAuthenticatedAppwriteUser, isProd } from "@/lib/utils";

function isRowNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
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

/**
 * Saves the signed-in person's own profile.
 *
 * Profile rows are read-only to their owner and the table no longer grants
 * `create` to users, so the self-service allow-list is what stands between
 * this request and the row, and both writes go through the admin client —
 * the same shape as `apps/web`'s `updateProfile` and the app's
 * `PUT /api/profile`. Identity columns (`student_id`, the `bi_*` link
 * columns, `roles`) are dropped here: a forged `student_id` would be taken
 * at face value by the member discount and the membership API. `email` is
 * dropped too — the Appwrite account is the source of truth for it, which
 * is why the profile form renders it read-only.
 */
export async function updateProfile(profile: Partial<Users>) {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    const writable = pickSelfServiceProfileFields(profile);
    const { db: adminDb } = await createAdminClient();

    const existing = await adminDb
      .getRow<Users>("app", "user", user.$id)
      .catch((error: unknown) => {
        // Only a missing row means "create it" — a read that failed for any
        // other reason must not be answered by writing a fresh row over
        // whatever is really there.
        if (isRowNotFound(error)) {
          return null;
        }
        throw error;
      });

    if (!existing) {
      // createRow's typed signature wants the full row; this seeds a partial
      // profile the person fills in over time. Omit the generic so the
      // Appwrite SDK accepts the partial payload.
      return await adminDb.createRow(
        "app",
        "user",
        user.$id,
        writable,
        buildProfileRowPermissions(user.$id)
      );
    }

    if (typeof writable.name === "string" && writable.name.length > 0) {
      await account.updateName(writable.name);
    }
    return await adminDb.updateRow<Users>("app", "user", user.$id, writable);
  } catch (error) {
    console.error("updateProfile failed");
    // Check if it's a specific Appwrite error we can handle
    if (typeof error === "object" && error !== null && "code" in error) {
      console.error(`Appwrite error code: ${error.code}`);
    }
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
