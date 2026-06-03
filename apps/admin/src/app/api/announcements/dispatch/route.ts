import { createAdminClient } from "@repo/api/server";
import { type NextRequest, NextResponse } from "next/server";
import { dispatchDueAnnouncements } from "@/lib/announcements/send";

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
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
    request.nextUrl.searchParams.get("secret"),
  ];
  return candidates.some((candidate) => candidate === secret);
}

/**
 * Dispatches every scheduled announcement whose send time has passed. Meant to
 * be hit on a cron (an Appwrite Function — see functions/scheduled-dispatch).
 * Gated by CRON_SECRET; no user session required.
 */
async function handleDispatch(request: NextRequest) {
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

  try {
    const { db, messaging, users } = await createAdminClient();
    const result = await dispatchDueAnnouncements({ db, messaging, users });
    return NextResponse.json({ ...result, ok: true });
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
