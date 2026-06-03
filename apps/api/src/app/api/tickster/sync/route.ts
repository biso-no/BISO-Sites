import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { type NextRequest, NextResponse } from "next/server";
import {
  getTicksterSyncConfig,
  getTicksterSyncSecret,
  syncTicksterPurchases,
} from "@/lib/tickster-sync";

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
  // Header-only — avoid the secret landing in access logs / referrers.
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
    request.headers.get("x-sync-secret"),
  ];
  return candidates.some((candidate) => candidate === secret);
}

async function handleSync(request: NextRequest) {
  const secret = getTicksterSyncSecret();
  if (!secret) {
    return NextResponse.json(
      {
        code: "SYNC_SECRET_NOT_CONFIGURED",
        error: "TICKSTER_SYNC_SECRET is not configured",
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

  const config = getTicksterSyncConfig();
  if (!config) {
    return NextResponse.json(
      {
        code: "TICKSTER_NOT_CONFIGURED",
        error: "TICKSTER_API_KEY and TICKSTER_EOG_CODE are required",
      },
      { status: 500 }
    );
  }

  try {
    const { db, users } = await createAdminClient();
    const fromPurchase = request.nextUrl.searchParams.get("from") ?? undefined;

    const result = await syncTicksterPurchases({
      db,
      config,
      fromPurchase,
      matchUser: async (email) => {
        // Exact-match guard: `search` is fuzzy, so verify the email equals.
        const found = await users.list([Query.limit(5)], email);
        const user = found.users.find(
          (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
        );
        return user?.$id ?? null;
      },
      logger: {
        error: (message) => console.error(`[tickster/sync] ${message}`),
        log: (message) => console.log(`[tickster/sync] ${message}`),
      },
    });

    return NextResponse.json({ ...result, ok: true });
  } catch (error) {
    console.error("[tickster/sync] Unexpected error:", error);
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
