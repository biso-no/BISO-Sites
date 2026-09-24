import { NextResponse } from "next/server";
import {
  getMembershipStatus,
  refreshMembershipStatus,
} from "@/lib/actions/membership";

const SERVICE_UNAVAILABLE = 503;

/**
 * Reasons `getMembershipStatus` reports when it could not reach an answer
 * (Finago outage, unexpected failure) — as opposed to a definitive "not a
 * member". Mirrors `TRANSIENT_REASONS` in `@repo/shared/member-pass/state` and
 * `TRANSIENT_STATUS_REASONS` in `@repo/shared/utils/membership-gate`, neither
 * of which is exported.
 */
const TRANSIENT_REASONS: ReadonlySet<string> = new Set([
  "finago_error",
  "unexpected_error",
]);

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

    // Per-user data; getMembershipStatus reuses a short-lived server-side
    // cache keyed by the authenticated user's student id, and we don't want
    // any shared CDN to serve one user's status to another.
    // `getMembershipStatus` never throws: an outage comes back as
    // `isMember: false` with a transient reason. Answering that with 200
    // tells clients "definitely not a member"; 503 lets them keep what they
    // had. The body is still the status, so callers can read the reason.
    const isTransientFailure =
      status.reason !== undefined && TRANSIENT_REASONS.has(status.reason);

    return NextResponse.json(status, {
      status: isTransientFailure ? SERVICE_UNAVAILABLE : undefined,
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
