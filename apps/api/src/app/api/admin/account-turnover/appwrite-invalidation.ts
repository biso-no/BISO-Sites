import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";

export interface AppwriteInvalidationResult {
  error?: string;
  sessionsRevoked: boolean;
  userFound: boolean;
}

/**
 * Revokes the previous holder's Appwrite sessions during a role-account
 * turnover.
 *
 * A role-account turnover repoints a *stable* role identity to a new holder:
 * the login address (`roleMailboxUpn`) does not change and the incoming holder
 * signs in with that same identity. We therefore only delete the outgoing
 * holder's active sessions — we must NOT disable the account or prune its team
 * memberships, or the newly handed-over role account would be locked out and
 * stripped of its role-derived access.
 *
 * Failures are reported in the result (not thrown) so the turnover flow can
 * surface them without aborting the already-completed mailbox handover.
 */
export async function invalidateAppwriteUser(
  email: string
): Promise<AppwriteInvalidationResult> {
  try {
    const { users } = await createAdminClient();
    const userList = await users.list([Query.equal("email", email)]);
    if (userList.users.length === 0) {
      return { sessionsRevoked: false, userFound: false };
    }

    const roleAccountUser = userList.users[0];
    // Revoke active sessions so the departing holder is logged out. The account
    // stays enabled and keeps its memberships so the incoming holder can sign
    // in to the same stable role identity with its role-derived access intact.
    await users.deleteSessions(roleAccountUser.$id);

    return {
      sessionsRevoked: true,
      userFound: true,
    };
  } catch (err) {
    console.error(
      "Failed to revoke Appwrite sessions during role-account turnover:",
      err
    );
    return {
      error: err instanceof Error ? err.message : "Unknown Appwrite error",
      sessionsRevoked: false,
      userFound: false,
    };
  }
}
