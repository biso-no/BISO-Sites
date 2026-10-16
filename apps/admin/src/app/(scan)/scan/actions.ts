"use server";

import { createAdminClient } from "@repo/api/server";
import { resolveGuestLink } from "@repo/shared/member-pass/guest-scan";
import { createRateLimiter } from "@repo/shared/member-pass/rate-limit";
import type { ScanOutcome } from "@repo/shared/member-pass/scan-types";
import { scanLogFor, verifyScan } from "@repo/shared/member-pass/verify-scan";
import { readMemberPassSecret } from "@repo/shared/utils/member-pass";
import { getScanMembershipStatus } from "@/lib/member-pass/membership-lookup";

const allowScan = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

type GuestScanResult =
  | { data: ScanOutcome; success: true }
  | {
      error: "invalid_link" | "rate_limited" | "not_configured" | "failed";
      success: false;
    };

/**
 * A scan from a guest scanner link. The link is re-checked on every scan so
 * revoking it takes effect immediately.
 */
export async function scanWithGuestLink(
  token: string,
  code: string
): Promise<GuestScanResult> {
  const secret = readMemberPassSecret();
  if (!secret) {
    return { error: "not_configured", success: false };
  }
  try {
    const link = await resolveGuestLink(token);
    if (!link) {
      return { error: "invalid_link", success: false };
    }
    if (!allowScan(link.$id)) {
      return { error: "rate_limited", success: false };
    }
    const { db } = await createAdminClient();
    const outcome = await verifyScan(
      code.trim(),
      { kind: "guest", linkId: link.$id },
      {
        db,
        getStatus: getScanMembershipStatus,
        now: new Date(),
        scans: scanLogFor(db),
        secret,
      }
    );
    return { data: outcome, success: true };
  } catch (error) {
    console.error("[Member Pass] Guest scan failed:", error);
    return { error: "failed", success: false };
  }
}
