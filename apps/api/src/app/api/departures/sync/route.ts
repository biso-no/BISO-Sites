import { createAdminClient } from "@repo/api/server";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { type NextRequest, NextResponse } from "next/server";
import { getDepartureSyncSecret, syncDepartures } from "@/lib/entur-departures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7);
}

function hasValidSyncSecret(request: NextRequest, secret: string) {
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
    request.headers.get("x-sync-secret"),
    request.nextUrl.searchParams.get("secret"),
  ];

  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

async function handleSync(request: NextRequest) {
  const secret = getDepartureSyncSecret();

  if (!secret) {
    return NextResponse.json(
      {
        code: "SYNC_SECRET_NOT_CONFIGURED",
        error: "ENTUR_SYNC_SECRET is not configured",
      },
      { status: 500 }
    );
  }

  if (!hasValidSyncSecret(request, secret)) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { db } = await createAdminClient();
    const result = await syncDepartures({ db });

    return NextResponse.json({
      ...result,
      ok: result.failed.length === 0,
    });
  } catch (error) {
    console.error("[departures/sync] Unexpected error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}

export function GET(request: NextRequest) {
  return handleSync(request);
}

export function POST(request: NextRequest) {
  return handleSync(request);
}
