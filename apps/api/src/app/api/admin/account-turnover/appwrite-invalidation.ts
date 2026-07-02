import { createAdminClient } from "@repo/api/server";
import { Query } from "@repo/api/client";

/**
 * Invalidates an Appwrite user session and prunes their memberships
 * during an account turnover offboarding.
 */
export async function invalidateAppwriteUser(email: string) {
  try {
    const { users, teams } = await createAdminClient();
    const userList = await users.list([Query.equal("email", email)]);
    if (userList.users.length > 0) {
      const outgoingUser = userList.users[0];
      await users.updateStatus(outgoingUser.$id, false);
      await users.deleteSessions(outgoingUser.$id);

      // Prune all memberships so the disabled user doesn't linger in team lists
      const memberships = await users.listMemberships(outgoingUser.$id);
      await Promise.all(
        memberships.memberships.map((m) =>
          teams.deleteMembership(m.teamId, m.$id)
        )
      );
    }
  } catch (err) {
    console.error("Failed to disable Appwrite user during turnover:", err);
  }
}
