import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";

type AzureGroup = { id: string; name: string };

/**
 * Sync a single team membership, creating the team if needed
 */
async function syncTeamMembership(
  teams: Awaited<ReturnType<typeof createAdminClient>>["teams"],
  azureGroup: AzureGroup,
  roles: string[],
  userId: string
): Promise<void> {
  try {
    await teams.createMembership(azureGroup.id, roles, undefined, userId);
  } catch (err: any) {
    if (err.code === 404) {
      console.log(`Creating new Team: ${azureGroup.name}`);
      await teams.create(azureGroup.id, azureGroup.name);
      await teams.createMembership(azureGroup.id, roles, undefined, userId);
    } else if (err.code === 409) {
      await updateExistingMembership(teams, azureGroup.id, roles, userId);
    } else {
      console.error(`Failed to sync team ${azureGroup.name}:`, err.message);
    }
  }
}

/**
 * Update an existing team membership with new roles
 */
async function updateExistingMembership(
  teams: Awaited<ReturnType<typeof createAdminClient>>["teams"],
  teamId: string,
  roles: string[],
  userId: string
): Promise<void> {
  const membershipList = await teams.listMemberships(teamId, [
    Query.equal("userId", userId),
  ]);

  if (membershipList.total > 0) {
    const membershipId = membershipList.memberships[0].$id;
    await teams.updateMembership(teamId, membershipId, roles);
  }
}

/**
 * Parse Azure groups into roles and teams to sync
 */
function parseAzureGroups(azureGroups: any[]): {
  roles: string[];
  teamsToSync: AzureGroup[];
  isGlobalAdmin: boolean;
} {
  const roles: string[] = ["member"];
  const teamsToSync: AzureGroup[] = [];
  let isGlobalAdmin = false;

  for (const group of azureGroups) {
    const name = group.displayName || "";

    if (!name.startsWith("SG-App-")) {
      continue;
    }

    if (name.startsWith("SG-App-Role-")) {
      const roleName = name
        .replace("SG-App-Role-", "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      roles.push(roleName);
      if (roleName === "globaladmin") {
        isGlobalAdmin = true;
      }
    } else if (
      name.startsWith("SG-App-Campus-") ||
      name.startsWith("SG-App-Dept-")
    ) {
      teamsToSync.push({ id: group.id, name });
    }
  }

  return { roles, teamsToSync, isGlobalAdmin };
}

export async function syncM365Permissions(userId: string) {
  const { users, teams } = await createAdminClient();

  try {
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
    const { roles, teamsToSync, isGlobalAdmin } = parseAzureGroups(azureGroups);

    if (isGlobalAdmin) {
      await users.updateLabels(userId, ["admin", "globaladmin"]);
    }

    await Promise.all(
      teamsToSync.map((azureGroup) =>
        syncTeamMembership(teams, azureGroup, roles, userId)
      )
    );

    console.log(
      `Synced User ${userId}: ${teamsToSync.length} Teams, Roles: [${roles}]`
    );
  } catch (error) {
    console.error("M365 Sync Failed:", error);
  }
}
