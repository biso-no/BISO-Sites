import { createAdminClient } from "@repo/api/server";
import { getProjects, listCostLines } from "@repo/connectors/24sevenoffice";
import { syncFinagoProjects } from "@repo/shared/utils/finago-project-sync";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Nightly Finago project sync: projects, their booking history and each
 * department's project share. Sends `x-cron-secret` from the scheduled
 * dispatcher, or `Authorization: Bearer ${CRON_SECRET}` when run by hand.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  return [readBearerToken(request), request.headers.get("x-cron-secret")].some(
    (candidate) => safeSecretCompare(candidate, secret)
  );
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[Finago Project Sync] CRON_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await createAdminClient();
    const counts = await syncFinagoProjects(db, {
      getProjects,
      listCostLines,
      now: new Date(),
    });
    console.log("[Finago Project Sync] Done", counts);
    return NextResponse.json(counts);
  } catch (error) {
    console.error("[Finago Project Sync] Sync failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
