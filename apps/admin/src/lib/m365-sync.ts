import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";

export async function syncM365Permissions(userId: string) {
  const { users, teams } = await createAdminClient();

  try {
    // 1. Get the Microsoft Access Token
    // We assume the user has linked their Microsoft account.
    const identityList = await users.listIdentities({
      queries: [Query.equal("userId", userId)],
    });
    const microsoftIdentity = identityList.identities.find(
      (id) => id.provider === "microsoft"
    );

    if (!microsoftIdentity?.providerAccessToken) {
      console.warn(`User ${userId} has no Microsoft token. Skipping sync.`);
      return;
    }

    // 2. Fetch User's Groups from Microsoft Graph
    const graphResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me/transitiveMemberOf?$select=id,displayName",
      {
        headers: {
          Authorization: `Bearer ${microsoftIdentity.providerAccessToken}`,
        },
      }
    );

    const graphData = await graphResponse.json();
    if (!graphResponse.ok) {
      throw new Error(`Graph Error: ${JSON.stringify(graphData)}`);
    }

    const azureGroups = (graphData.value as any[]) || [];

    // 3. Parse Groups into Roles and Teams
    const roles: string[] = ["member"]; // Every user gets 'member' role
    const teamsToSync: { id: string; name: string }[] = [];
    let isGlobalAdmin = false;

    for (const group of azureGroups) {
      const name = group.displayName || "";

      // We only care about groups with your specific prefix
      if (!name.startsWith("SG-App-")) {
        continue;
      }

      // CASE A: Roles (SG-App-Role-finance)
      if (name.startsWith("SG-App-Role-")) {
        const rawRole = name.replace("SG-App-Role-", "").toLowerCase();

        // Sanitize: "global_admin" -> "globaladmin"
        const roleName = rawRole.replace(/[^a-z0-9]/g, "");

        roles.push(roleName);

        // Update check to match the sanitized version
        if (roleName === "globaladmin") {
          isGlobalAdmin = true;
        }
      }

      // CASE B: Scopes (SG-App-Campus-* or SG-App-Dept-*)
      else if (
        name.startsWith("SG-App-Campus-") ||
        name.startsWith("SG-App-Dept-")
      ) {
        teamsToSync.push({
          id: group.id, // We use the Azure GUID as the Appwrite Team ID
          name, // We use the Azure Name as the Team Name
        });
      }
    }

    // 4. Sync Global Admin Label
    if (isGlobalAdmin) {
      await users.updateLabels(userId, ["admin", "globaladmin"]);
    }

    // 5. Sync Teams (Dynamic Creation)
    // We process these in parallel for speed
    await Promise.all(
      teamsToSync.map(async (azureGroup) => {
        try {
          // Attempt to add user to the team using the Azure GUID
          await teams.createMembership(azureGroup.id, roles, undefined, userId);
        } catch (err: any) {
          // Error handling logic
          if (err.code === 404) {
            // TEAM MISSING? Create it on the fly!
            // This is the magic step that handles new departments automatically.
            console.log(`Creating new Team: ${azureGroup.name}`);
            await teams.create(azureGroup.id, azureGroup.name);

            // Retry adding the member
            await teams.createMembership(
              azureGroup.id,
              roles,
              undefined,
              userId
            );
          } else if (err.code === 409) {
            // USER ALREADY IN TEAM? Update their roles.
            // This handles the case where a user gets promoted to 'finance'
            // but is already in the team as 'member'.

            // 1. Find the membership ID (needed for update)
            const membershipList = await teams.listMemberships(azureGroup.id, [
              Query.equal("userId", userId),
            ]);

            if (membershipList.total > 0) {
              const membershipId = membershipList.memberships[0].$id;
              // Only update if roles have actually changed to save API calls
              // (Optional optimization: compare arrays)
              await teams.updateMembership(azureGroup.id, membershipId, roles);
            }
          } else {
            // Unknown error
            console.error(
              `Failed to sync team ${azureGroup.name}:`,
              err.message
            );
          }
        }
      })
    );

    console.log(
      `Synced User ${userId}: ${teamsToSync.length} Teams, Roles: [${roles}]`
    );
  } catch (error) {
    console.error("M365 Sync Failed:", error);
    // Don't crash the login flow if sync fails, just log it.
  }
}
