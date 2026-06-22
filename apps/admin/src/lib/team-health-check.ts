import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { checkRequiredTeams, type TeamHealthReport } from "./team-health";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

/**
 * Collect every Appwrite team `$id` using the service-key client. Paginated so
 * the count is complete even as BISO accumulates department/campus teams.
 */
async function listAllTeamIds(): Promise<string[]> {
  const { teams } = await createAdminClient();
  const ids: string[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const { teams: rows, total } = await teams.list([
      Query.limit(PAGE_SIZE),
      Query.offset(page * PAGE_SIZE),
    ]);

    for (const team of rows) {
      ids.push(team.$id);
    }

    if (ids.length >= total || rows.length < PAGE_SIZE) {
      break;
    }
  }

  return ids;
}

/**
 * Fetch the live required-team health report. Shared by the admin health
 * endpoint and the operations page. Requires the service-key client, so only
 * call it from a globally-gated server context.
 */
export async function fetchRequiredTeamHealth(): Promise<TeamHealthReport> {
  return checkRequiredTeams(await listAllTeamIds());
}
