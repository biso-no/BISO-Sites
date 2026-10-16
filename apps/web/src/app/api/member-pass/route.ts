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
import { NextResponse } from "next/server";
import { resolveMemberPass } from "@/lib/member-pass/resolve";

const NO_STORE = { "Cache-Control": "private, no-store" };

function json(body: MemberPassResponse) {
  return NextResponse.json(body, { headers: NO_STORE });
}

/**
 * The signed-in member's pass: ten minutes of rotating codes, issued only
 * after a live membership check. Non-members get their state and no codes.
 */
export async function GET() {
  const resolved = await resolveMemberPass();
  if (resolved.state === "unauthenticated") {
    return NextResponse.json(
      { error: "not_authenticated" },
      { headers: NO_STORE, status: 401 }
    );
  }
  if (resolved.state !== "active") {
    return json({ state: resolved.state });
  }

  const secret = readMemberPassSecret();
  if (!secret) {
    console.error("[Member Pass] MEMBER_PASS_SECRET is not configured");
    return json({ state: "unavailable" });
  }

  const now = Date.now();
  return json({
    codes: issueWebPassCodes(resolved.userId, now, secret),
    dayColor: dayColor(new Date(now), secret),
    holder: resolved.holder,
    serverNow: now,
    state: "active",
    wallets: {
      apple: readAppleWalletConfig() !== null,
      google: readGoogleWalletConfig() !== null,
    },
  });
}
