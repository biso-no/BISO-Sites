import { createAdminClient } from "@repo/api/server";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { publishDueJobs } from "@/lib/job-publication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

function hasValidSecret(request: NextRequest, secret: string) {
  // Header-only — keep the secret out of access logs / referrers.
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
  ];
  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

/**
 * Publishes scheduled vacancies whose publish time has passed. Hit on a cron
 * by the scheduled-dispatch Appwrite Function (JOBS_PUBLISH_SCHEDULED_URL).
 * Gated by CRON_SECRET; no user session required.
 */
async function handlePublishScheduled(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { code: "SECRET_NOT_CONFIGURED", error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (!hasValidSecret(request, secret)) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 }
    );
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
