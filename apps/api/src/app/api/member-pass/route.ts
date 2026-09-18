import type { MemberPassResponse } from "@repo/shared/member-pass/types";
import {
  readAppleWalletConfig,
  readGoogleWalletConfig,
} from "@repo/shared/member-pass/wallet-config";
import {
  dayColor,
  issueWebPassCodes,
  readMemberPassSecret,
} from "@repo/shared/utils/member-pass";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { resolveMemberPassForRequest } from "@/lib/member-pass/resolve";

export const dynamic = "force-dynamic";

function json(
  body: MemberPassResponse | { error: string },
  origin: string | null,
  status = 200
) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

/**
 * The app caller's pass: ten minutes of rotating codes, issued only after a
 * live membership check. Non-members get their state and no codes. Response
 * shape matches the website's `GET /api/member-pass`.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const resolved = await resolveMemberPassForRequest(req);
  if (resolved.state === "unauthenticated") {
    return json({ error: "not_authenticated" }, origin, 401);
  }
  if (resolved.state !== "active") {
    return json({ state: resolved.state }, origin);
  }

  const secret = readMemberPassSecret();
  if (!secret) {
    console.error("[Member Pass] MEMBER_PASS_SECRET is not configured");
    return json({ state: "unavailable" }, origin);
  }

  const now = Date.now();
  return json(
    {
      codes: issueWebPassCodes(resolved.userId, now, secret),
      dayColor: dayColor(new Date(now), secret),
      holder: resolved.holder,
      serverNow: now,
      state: "active",
      wallets: {
        apple: readAppleWalletConfig() !== null,
        google: readGoogleWalletConfig() !== null,
      },
    },
    origin
  );
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
