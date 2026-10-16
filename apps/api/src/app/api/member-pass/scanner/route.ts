import type { DayColor } from "@repo/shared/utils/member-pass";
import { dayColor, readMemberPassSecret } from "@repo/shared/utils/member-pass";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { requireScanner } from "@/lib/member-pass/scanner-auth";

export const dynamic = "force-dynamic";

interface ScannerAccessResponse {
  campusId: string | null;
  dayColor: DayColor;
  expiresAt: string | null;
}

function json(
  body: ScannerAccessResponse | { error: string },
  origin: string | null,
  status = 200
) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

/**
 * The app caller's scanner access: their grant's campus and expiry, and
 * today's pass color (so the app can show the same color the admin scanner
 * shows). 403s unless the caller currently holds an active scanner grant —
 * re-checked on every call, so a revoked grant stops working immediately.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const secret = readMemberPassSecret();
  if (!secret) {
    console.error("[Member Pass] MEMBER_PASS_SECRET is not configured");
    return json({ error: "not_configured" }, origin, 503);
  }

  try {
    const now = new Date();
    const auth = await requireScanner(req, now);
    if (!auth.ok) {
      return json({ error: auth.error }, origin, auth.status);
    }

    return json(
      {
        campusId: auth.grant.campus_id,
        dayColor: dayColor(now, secret),
        expiresAt: auth.grant.expires_at,
      },
      origin
    );
  } catch (cause) {
    console.error("[Member Pass] Scanner access check failed:", cause);
    return json({ error: "failed" }, origin, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
