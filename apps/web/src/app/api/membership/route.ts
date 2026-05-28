import { NextResponse } from "next/server";
import {
  getMembershipStatus,
  refreshMembershipStatus,
} from "@/lib/actions/membership";

/**
 * GET: Check user's membership status
 * Uses cached value if available, otherwise fetches from Finago
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  try {
    const status = forceRefresh
      ? await refreshMembershipStatus()
      : await getMembershipStatus();

    // Per-user data; the in-memory cookie cache in getMembershipStatus
    // already handles short-term reuse, and we don't want any shared
    // CDN to serve one user's status to another.
    return NextResponse.json(status, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[Membership API] Error:", error);
    return NextResponse.json(
      { isMember: false, reason: "error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
