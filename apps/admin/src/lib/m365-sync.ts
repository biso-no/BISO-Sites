import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  grantDeptTeamAccess,
  grantTeamContentAccess,
} from "./team-provisioning";
import { expandDeptName } from "./campus-constants";

type AzureGroup = { id: string; name: string };

/**
 * Derive a deterministic Appwrite team $id from the Azure displayName.
 * Using the lowercased displayName ensures the ID is stable and predictable
 * without needing to store or look up the Azure GUID.
 * e.g. "SG-App-Campus-Oslo" -> "sg-app-campus-oslo"
 */
function sanitizeTeamId(azureDisplayName: string): string {
  return azureDisplayName.toLowerCase();
}

/**
 * Derive a clean human-readable team name from the Azure displayName.
 * Strips the SG-App-Campus- / SG-App-Dept- prefix and expands camelCase.
 * e.g. "SG-App-Dept-OperationsUnit" -> "Operations Unit"
 *      "SG-App-Campus-Oslo"         -> "Oslo"
 */
function sanitizeTeamName(azureDisplayName: string): string {
  const raw = azureDisplayName
    .replace("SG-App-Campus-", "")
    .replace("SG-App-Dept-", "");
  return expandDeptName(raw);
}

/**
 * Sync a single team membership, creating the team if needed
 */
async function syncTeamMembership(
  teams: Awaited<ReturnType<typeof createAdminClient>>["teams"],
  azureGroup: AzureGroup,
  roles: string[],
  userId: string
): Promise<void> {
  const teamId = sanitizeTeamId(azureGroup.name);
  const teamName = sanitizeTeamName(azureGroup.name);

  try {
    await teams.createMembership(teamId, roles, undefined, userId);
  } catch (err: any) {
    if (err.code === 404) {
      console.log(`Creating new Team: ${teamName} (${teamId})`);
      await teams.create(teamId, teamName);
      await teams.createMembership(teamId, roles, undefined, userId);

      // Only dept teams get table-level create permissions; campus teams get nothing
      if (azureGroup.name.startsWith("SG-App-Dept-")) {
        await grantTeamContentAccess(teamId);

        // Provision row-level write permissions on matching department rows
        const rawDeptName = azureGroup.name.replace("SG-App-Dept-", "");
        await grantDeptTeamAccess(teamId, rawDeptName);
      }
    } else if (err.code === 409) {
      await updateExistingMembership(teams, teamId, roles, userId);
    } else {
      console.error(`Failed to sync team ${teamName}:`, err.message);
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
 * Parse Azure groups into teams to sync.
 * Only SG-App-Campus-* and SG-App-Dept-* groups are processed.
 * SG-App-Role-* groups are no longer supported — access is derived entirely
 * from campus + department team combinations.
 */
function parseAzureGroups(azureGroups: any[]): {
  teamsToSync: AzureGroup[];
} {
  const teamsToSync: AzureGroup[] = [];

  for (const group of azureGroups) {
    const name = group.displayName || "";

    if (name.startsWith("SG-App-Campus-") || name.startsWith("SG-App-Dept-")) {
      teamsToSync.push({ id: group.id, name });
    }
  }

  return { teamsToSync };
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
    const { teamsToSync } = parseAzureGroups(azureGroups);

    await Promise.all(
      teamsToSync.map((azureGroup) =>
        syncTeamMembership(teams, azureGroup, ["member"], userId)
      )
    );

    console.log(`Synced User ${userId}: ${teamsToSync.length} Teams`);
  } catch (error) {
    console.error("M365 Sync Failed:", error);
  }
}
