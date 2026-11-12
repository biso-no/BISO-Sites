import { createAdminClient } from "@repo/api/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/api-auth";
import { publishDueJobs } from "@/lib/job-publication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Publishes scheduled vacancies whose publish time has passed. Hit on a cron
 * by the scheduled-dispatch Appwrite Function (JOBS_PUBLISH_SCHEDULED_URL).
 * Gated by CRON_SECRET; no user session required.
 */
async function handlePublishScheduled(request: NextRequest) {
  const rejected = requireCronSecret(request);
  if (rejected) {
    return rejected;
  }

  const startedAt = Date.now();
  try {
    const { db } = await createAdminClient();
    const result = await publishDueJobs(db);
    if (result.published > 0) {
      revalidatePath("/jobs");
    }
    // Surface publish failures to the scheduler, which classifies target
    // health by response status — a 200 would hide them.
    const ok = result.failed === 0;
    return NextResponse.json(
      {
        ...result,
        durationMs: Date.now() - startedAt,
        ok,
      },
      { status: ok ? 200 : 500 }
    );
  } catch (error) {
    console.error("[recruitment/publish-scheduled] Unexpected error:", {
      durationMs: Date.now() - startedAt,
      error,
    });
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}

export function GET(request: NextRequest) {
  return handlePublishScheduled(request);
}

export function POST(request: NextRequest) {
  return handlePublishScheduled(request);
}
