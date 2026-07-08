import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { listAllUserMemberships } from "@repo/shared/utils/appwrite-memberships";
import { expandDeptName } from "./campus-constants";
import {
  grantDeptTeamAccess,
  grantTeamContentAccess,
  grantTeamRecruitmentAccess,
} from "./team-provisioning";

interface AzureGroup {
  id: string;
  name: string;
}

/**
 * Team ID prefixes owned by Azure group reconciliation. Only memberships whose
 * team IDs start with one of these are eligible for pruning — Appwrite-only
 * teams (e.g. `biso-members`) are never touched by the Microsoft sync.
 */
const AZURE_SYNCED_TEAM_ID_PREFIXES = [
  "sg-app-campus-",
  "sg-app-dept-",
] as const;

function isAzureSyncedTeamId(teamId: string): boolean {
  return AZURE_SYNCED_TEAM_ID_PREFIXES.some((prefix) =>
    teamId.startsWith(prefix)
  );
}

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
  const isDeptTeam = azureGroup.name.startsWith("SG-App-Dept-");

  try {
    await teams.createMembership(teamId, roles, undefined, userId);
    // Team already existed and the user was (re)added. Backfill the table-level
    // content/recruitment create grants (see ensureDeptTeamTableGrants).
    if (isDeptTeam) {
      await ensureDeptTeamTableGrants(teamId);
    }
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 404) {
      await teams.create(teamId, teamName);
      await teams.createMembership(teamId, roles, undefined, userId);

      // Only dept teams get table-level create permissions; campus teams get nothing
      if (isDeptTeam) {
        await ensureDeptTeamTableGrants(teamId);

        // Provision row-level write permissions on matching department rows.
        // Unlike the table grants this rewrites the dept row every call, so it
        // only runs when the team is first created.
        const rawDeptName = azureGroup.name.replace("SG-App-Dept-", "");
        await grantDeptTeamAccess(teamId, rawDeptName);
      }
    } else if (e.code === 409) {
      await updateExistingMembership(teams, teamId, roles, userId);
      // User was already a member — the team predates this sync, so backfill the
      // table-level grants in case they were never provisioned.
      if (isDeptTeam) {
        await ensureDeptTeamTableGrants(teamId);
      }
    } else {
      throw err;
    }
  }
}

/**
 * Ensure a dept team holds the table-level create grants on content and
 * recruitment tables. Both underlying grants are idempotent — they read the
 * current table permissions and only write when the grant is missing — so this
 * is safe (and cheap once provisioned) to run on every sync. It exists because
 * the content tables no longer carry a broad `create("users")` grant; each dept
 * team gets a `create("team:…")` grant instead, and running this outside the
 * team-creation path backfills teams that predate those per-team grants (or an
 * environment where the config was applied before the grants existed) so staff
 * don't silently lose the ability to create events/news/products/pages.
 */
async function ensureDeptTeamTableGrants(teamId: string): Promise<void> {
  await grantTeamContentAccess(teamId);
  await grantTeamRecruitmentAccess(teamId);
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
function parseAzureGroups(
  azureGroups: { id: string; displayName?: string }[]
): {
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
      // No cached Microsoft token; the user signed in via magic link without
      // a fresh OAuth flow. Skip silently — this is a normal path.
      return;
    }

    let azureGroups: { id: string; displayName?: string }[] = [];
    let nextLink: string | null =
      "https://graph.microsoft.com/v1.0/me/transitiveMemberOf?$select=id,displayName";

    while (nextLink) {
      const res: Response = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${microsoftIdentity.providerAccessToken}`,
        },
      });

      const graphData = await res.json();
      if (!res.ok) {
        throw new Error(`Graph Error: ${JSON.stringify(graphData)}`);
      }

      azureGroups = azureGroups.concat(
        (graphData.value as { id: string; displayName?: string }[]) || []
      );
      nextLink = graphData["@odata.nextLink"] || null;
    }

    const { teamsToSync } = parseAzureGroups(azureGroups);
    const expectedTeamIds = new Set(
      teamsToSync.map((g) => sanitizeTeamId(g.name))
    );

    // Reconcile: delete Azure-synced memberships that are no longer in Azure.
    // Paginated — the default 25-row read would leave stale roles unpruned
    // for users in many teams (PR-075). Pruning is restricted to team IDs owned
    // by Azure group reconciliation so Appwrite-only memberships (e.g.
    // `biso-members`) survive the sync.
    const currentMemberships = await listAllUserMemberships(users, userId);
    for (const membership of currentMemberships) {
      if (
        isAzureSyncedTeamId(membership.teamId) &&
        !expectedTeamIds.has(membership.teamId)
      ) {
        // User is in an Azure-synced team but not in the corresponding Azure group
        await teams.deleteMembership(membership.teamId, membership.$id);
      }
    }

    // Provision expected teams
    await Promise.all(
      teamsToSync.map((azureGroup) =>
        syncTeamMembership(teams, azureGroup, ["member"], userId)
      )
    );
  } catch (error) {
    console.error("M365 Sync Failed:", error);
    throw error; // PR-077: surface failure so the caller can abort/retry
  }
}
