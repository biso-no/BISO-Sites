import { createAdminClient } from "@repo/api/server";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { type NextRequest, NextResponse } from "next/server";
import {
  getTicksterEventsSyncConfig,
  getTicksterEventsSyncSecret,
  syncTicksterEvents,
} from "@/lib/tickster-events-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Enriching ~50 events/campus with per-event detail calls can take a while.
export const maxDuration = 300;

function readBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

function hasValidSyncSecret(request: NextRequest, secret: string) {
  // Header-only — avoid the secret landing in access logs / referrers.
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
    request.headers.get("x-sync-secret"),
  ];
  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

async function handleSync(request: NextRequest) {
  const secret = getTicksterEventsSyncSecret();
  if (!secret) {
    return NextResponse.json(
      {
        code: "SYNC_SECRET_NOT_CONFIGURED",
        error: "CRON_SECRET is not configured",
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

  const config = getTicksterEventsSyncConfig();
  if (!config) {
    return NextResponse.json(
      {
        code: "TICKSTER_NOT_CONFIGURED",
        error: "TICKSTER_EVENTS_API_KEY (or TICKSTER_API_KEY) is required",
      },
      { status: 500 }
    );
  }

  try {
    const { db } = await createAdminClient();

    const result = await syncTicksterEvents({
      config,
      db,
      logger: {
        error: (message) => console.error(`[tickster/events/sync] ${message}`),
        log: (message) => console.info(`[tickster/events/sync] ${message}`),
      },
    });

    return NextResponse.json({ ...result, ok: true });
  } catch (error) {
    console.error("[tickster/events/sync] Unexpected error:", error);
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
