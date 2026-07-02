import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { listAllUserMemberships } from "@repo/shared/utils/appwrite-memberships";

export interface AppwriteInvalidationResult {
  error?: string;
  invalidated: boolean;
  membershipsPruned: number;
  userFound: boolean;
}

/**
 * Invalidates an Appwrite user session and prunes their memberships
 * during an account turnover offboarding.
 *
 * Failures are reported in the result (not thrown) so the turnover flow can
 * surface them without aborting the already-completed mailbox handover.
 */
export async function invalidateAppwriteUser(
  email: string
): Promise<AppwriteInvalidationResult> {
  try {
    const { users, teams } = await createAdminClient();
    const userList = await users.list([Query.equal("email", email)]);
    if (userList.users.length === 0) {
      return { invalidated: false, membershipsPruned: 0, userFound: false };
    }

    const outgoingUser = userList.users[0];
    await users.updateStatus(outgoingUser.$id, false);
    await users.deleteSessions(outgoingUser.$id);

    // Prune all memberships so the disabled user doesn't linger in team
    // lists. Paginated — the default 25-row read misses teams past row 25.
    const memberships = await listAllUserMemberships(users, outgoingUser.$id);
    for (const membership of memberships) {
      await teams.deleteMembership(membership.teamId, membership.$id);
    }

    return {
      invalidated: true,
      membershipsPruned: memberships.length,
      userFound: true,
    };
  } catch (err) {
    console.error("Failed to disable Appwrite user during turnover:", err);
    return {
      error: err instanceof Error ? err.message : "Unknown Appwrite error",
      invalidated: false,
      membershipsPruned: 0,
      userFound: false,
    };
  }
}
