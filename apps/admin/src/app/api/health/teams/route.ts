import { NextResponse } from "next/server";
import { getUserAuthContext } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";
import { fetchRequiredTeamHealth } from "@/lib/team-health-check";

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
    const report = await fetchRequiredTeamHealth();
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
