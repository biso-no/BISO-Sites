import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { getUserAuthContext } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";
import { checkRequiredTeams } from "@/lib/team-health";

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
 * Global-admin / monitoring view of required-team health. Returns 200 when
 * every operational team exists, 503 when one or more are missing so an
 * external uptime monitor can alert on it. The body lists each required team,
 * whether it is present, and the operational fix for any gap.
 */
export async function GET() {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const report = checkRequiredTeams(await listAllTeamIds());
    return NextResponse.json(
      { ...report, checkedAt: new Date().toISOString() },
      { status: report.ok ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
