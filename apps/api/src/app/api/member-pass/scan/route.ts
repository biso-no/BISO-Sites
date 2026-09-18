import { createAdminClient } from "@repo/api/server";
import { createRateLimiter } from "@repo/shared/member-pass/rate-limit";
import type { ScanOutcome } from "@repo/shared/member-pass/scan-types";
import { scanLogFor, verifyScan } from "@repo/shared/member-pass/verify-scan";
import { readMemberPassSecret } from "@repo/shared/utils/member-pass";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { getScanMembershipStatus } from "@/lib/member-pass/scan-membership";
import { requireScanner } from "@/lib/member-pass/scanner-auth";

export const dynamic = "force-dynamic";

const MAX_CODE_LENGTH = 256;
// Per user id, per server instance — same limit and shape as the admin
// scanner screen and the guest-link scanner.
const scanRateLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

function json(
  body: ScanOutcome | { error: string },
  origin: string | null,
  status = 200
) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

type ParsedScanBody = { code: string; ok: true } | { ok: false };

async function parseScanBody(req: NextRequest): Promise<ParsedScanBody> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false };
  }
  if (typeof body !== "object" || body === null) {
    return { ok: false };
  }
  const { code } = body as { code?: unknown };
  if (typeof code !== "string") {
    return { ok: false };
  }
  const trimmed = code.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_CODE_LENGTH) {
    return { ok: false };
  }
  return { code: trimmed, ok: true };
}

/**
 * Scans a member pass code as the signed-in app caller. Requires an active
 * scanner grant, re-checked on every call, then rate-limits per caller and
 * verifies the code exactly like the admin scanner screen (same shared
 * `verifyScan`), logging the scan with `scanner_user_id` set to the caller.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const secret = readMemberPassSecret();
  if (!secret) {
    console.error("[Member Pass] MEMBER_PASS_SECRET is not configured");
    return json({ error: "not_configured" }, origin, 503);
  }

  const now = new Date();

  try {
    const auth = await requireScanner(req, now);
    if (!auth.ok) {
      return json({ error: auth.error }, origin, auth.status);
    }

    const parsed = await parseScanBody(req);
    if (!parsed.ok) {
      return json({ error: "invalid_body" }, origin, 400);
    }

    if (!scanRateLimiter(auth.userId, now.getTime())) {
      return json({ error: "rate_limited" }, origin, 429);
    }

    const { db } = await createAdminClient();
    const outcome = await verifyScan(
      parsed.code,
      { kind: "staff", userId: auth.userId },
      {
        db,
        getStatus: getScanMembershipStatus,
        now,
        scans: scanLogFor(db),
        secret,
      }
    );
    return json(outcome, origin);
  } catch (cause) {
    console.error("[Member Pass] App scan failed:", cause);
    return json({ error: "failed" }, origin, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
