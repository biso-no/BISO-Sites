import { createAdminClient } from "@repo/api/server";
import { type NextRequest, NextResponse } from "next/server";
import { dispatchDueAnnouncements } from "@/lib/announcements/send";
import { requireCronSecret } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Dispatches every scheduled announcement whose send time has passed. Meant to
 * be hit on a cron (an Appwrite Function — see functions/scheduled-dispatch).
 * Gated by CRON_SECRET; no user session required.
 */
async function handleDispatch(request: NextRequest) {
  const rejected = requireCronSecret(request);
  if (rejected) {
    return rejected;
  }

  try {
    const { db, messaging } = await createAdminClient();
    const result = await dispatchDueAnnouncements({ db, messaging });
    // Surface send failures to the scheduler, which classifies target health by
    // response status — a 200 would log a failed dispatch as a successful ping.
    const ok = result.failed === 0;
    return NextResponse.json({ ...result, ok }, { status: ok ? 200 : 500 });
  } catch (error) {
    console.error("[announcements/dispatch] Unexpected error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}

export function GET(request: NextRequest) {
  return handleDispatch(request);
}

export function POST(request: NextRequest) {
  return handleDispatch(request);
}
